package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.entity.FileObject;
import com.ctms.mapper.FileObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {
    private final FileObjectMapper fileObjectMapper;

    @GetMapping("/{fileId}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<FileObject> getFile(@PathVariable String fileId) {
        return ApiResponse.success(fileObjectMapper.selectById(fileId));
    }

    @PostMapping("/upload-url")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Map<String, Object>> getUploadUrl(@RequestBody Map<String, Object> body) {
        String fileId = UUID.randomUUID().toString().replace("-", "");
        String fileName = (String) body.getOrDefault("fileName", "unknown");

        FileObject fo = new FileObject();
        fo.setId(fileId);
        fo.setOriginalName(fileName);
        fo.setStoragePath("upload/" + fileId + "/" + fileName);
        fo.setBucketName("raw");
        fo.setMimeType((String) body.get("mimeType"));
        fo.setStatus("UPLOADING");
        fo.setBelongEntity((String) body.get("belongEntity"));
        fo.setBelongId((String) body.get("belongId"));
        fileObjectMapper.insert(fo);

        return ApiResponse.success(Map.of(
                "fileId", fileId,
                "uploadUrl", "http://localhost:9000/ctms-raw/" + fo.getStoragePath(),
                "expiresIn", 900
        ));
    }

    @PostMapping("/{fileId}/confirm")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> confirmUpload(@PathVariable String fileId) {
        FileObject fo = fileObjectMapper.selectById(fileId);
        if (fo != null) {
            fo.setStatus("UPLOADED");
            fileObjectMapper.updateById(fo);
        }
        return ApiResponse.success(null);
    }
}
