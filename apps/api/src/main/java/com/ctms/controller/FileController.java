package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.common.BusinessException;
import com.ctms.common.ErrorCode;
import com.ctms.entity.FileObject;
import com.ctms.mapper.FileObjectMapper;
import io.minio.*;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {

    private final FileObjectMapper fileObjectMapper;
    private final MinioClient minioClient;

    @Value("${minio.buckets.raw:ctms-raw}")
    private String rawBucket;

    @GetMapping("/{fileId}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<FileObject> getFile(@PathVariable String fileId) {
        FileObject fo = fileObjectMapper.selectById(fileId);
        if (fo == null) {
            return ApiResponse.error(ErrorCode.FILE_NOT_FOUND.getCode(), "文件不存在");
        }
        return ApiResponse.success(fo);
    }

    @PostMapping("/upload-url")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> getUploadUrl(@RequestBody Map<String, Object> body) {
        String fileName = (String) body.getOrDefault("fileName", "unknown");
        String mimeType = (String) body.getOrDefault("mimeType", "application/octet-stream");
        Object sizeObj = body.get("fileSize");
        Long fileSize = sizeObj != null ? Long.parseLong(sizeObj.toString()) : null;

        // Validate size
        if (fileSize != null && fileSize > 50 * 1024 * 1024) {
            return ApiResponse.error(ErrorCode.FILE_SIZE_EXCEEDED.getCode(), "文件大小不能超过50MB");
        }

        String fileId = UUID.randomUUID().toString().replace("-", "");
        String objectKey = "upload/" + fileId + "/" + fileName;

        try {
            // Ensure bucket exists
            boolean bucketExists = minioClient.bucketExists(
                    BucketExistsArgs.builder().bucket(rawBucket).build());
            if (!bucketExists) {
                minioClient.makeBucket(MakeBucketArgs.builder().bucket(rawBucket).build());
                log.info("Created MinIO bucket: {}", rawBucket);
            }

            // Generate presigned PUT URL (15 min expiry)
            String uploadUrl = minioClient.getPresignedObjectUrl(
                    GetPresignedObjectUrlArgs.builder()
                            .method(Method.PUT)
                            .bucket(rawBucket)
                            .object(objectKey)
                            .expiry(15, TimeUnit.MINUTES)
                            .build());

            // Create FileObject record (status = UPLOADING)
            FileObject fo = new FileObject();
            fo.setId(fileId);
            fo.setOriginalName(fileName);
            fo.setStoragePath(objectKey);
            fo.setBucketName(rawBucket);
            fo.setMimeType(mimeType);
            fo.setFileSize(fileSize);
            fo.setStatus("UPLOADING");
            fo.setBelongEntity((String) body.getOrDefault("belongEntity", "document"));
            fo.setBelongId((String) body.getOrDefault("belongId", null));
            fileObjectMapper.insert(fo);

            log.info("Generated presigned URL for file {} → {}", fileId, objectKey);

            return ApiResponse.success(Map.of(
                    "fileId", fileId,
                    "objectKey", objectKey,
                    "uploadUrl", uploadUrl,
                    "method", "PUT",
                    "bucket", rawBucket,
                    "expiresIn", 900
            ));
        } catch (Exception e) {
            log.error("Failed to generate upload URL for file: {}", fileName, e);
            return ApiResponse.error(ErrorCode.FILE_UPLOAD_FAILED.getCode(), "生成上传URL失败: " + e.getMessage());
        }
    }

    @PostMapping("/{fileId}/confirm")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> confirmUpload(@PathVariable String fileId,
                                                           @RequestBody Map<String, Object> body) {
        FileObject fo = fileObjectMapper.selectById(fileId);
        if (fo == null) {
            return ApiResponse.error(ErrorCode.FILE_NOT_FOUND.getCode(), "文件不存在");
        }

        try {
            // Verify file exists in MinIO
            StatObjectResponse stat = minioClient.statObject(
                    StatObjectArgs.builder()
                            .bucket(fo.getBucketName())
                            .object(fo.getStoragePath())
                            .build());

            fo.setFileSize(stat.size());
            fo.setStatus("UPLOADED");
            fo.setFileHash((String) body.getOrDefault("fileHash", ""));
            fileObjectMapper.updateById(fo);

            log.info("File confirmed: {} ({} bytes)", fo.getOriginalName(), stat.size());

            return ApiResponse.success(Map.of(
                    "fileId", fileId,
                    "status", "UPLOADED",
                    "fileSize", stat.size()
            ));
        } catch (Exception e) {
            log.error("Failed to confirm file upload: {}", fileId, e);
            fo.setStatus("failed");
            fileObjectMapper.updateById(fo);
            return ApiResponse.error(ErrorCode.FILE_UPLOAD_FAILED.getCode(), "文件确认失败: " + e.getMessage());
        }
    }
}
