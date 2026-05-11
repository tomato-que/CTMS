package com.ctms.service;

import com.ctms.common.BusinessException;
import com.ctms.common.ErrorCode;
import com.ctms.entity.FileObject;
import com.ctms.mapper.FileObjectMapper;
import io.minio.GetPresignedObjectUrlArgs;
import io.minio.MinioClient;
import io.minio.http.Method;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class FileService {
    private final MinioClient minioClient;
    private final FileObjectMapper fileObjectMapper;

    public FileObject getById(String id) {
        return fileObjectMapper.selectById(id);
    }

    public String generateUploadUrl(String fileName, String mimeType, long fileSize, String belongEntity, String belongId) {
        String fileId = UUID.randomUUID().toString().replace("-", "");
        String objectPath = "upload/" + fileId + "/" + fileName;

        FileObject fo = new FileObject();
        fo.setId(fileId);
        fo.setOriginalName(fileName);
        fo.setStoragePath(objectPath);
        fo.setBucketName("raw");
        fo.setMimeType(mimeType);
        fo.setFileSize(fileSize);
        fo.setStatus("UPLOADING");
        fo.setBelongEntity(belongEntity);
        fo.setBelongId(belongId);
        fileObjectMapper.insert(fo);

        try {
            return minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                    .method(Method.PUT).bucket("ctms-raw").object(objectPath)
                    .expiry(15, TimeUnit.MINUTES).build());
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.FILE_UPLOAD_FAILED);
        }
    }

    public void confirmUpload(String fileId, String fileHash) {
        FileObject fo = fileObjectMapper.selectById(fileId);
        if (fo == null) throw new BusinessException(ErrorCode.FILE_NOT_FOUND);
        fo.setFileHash(fileHash);
        fo.setStatus("UPLOADED");
        fileObjectMapper.updateById(fo);
    }
}
