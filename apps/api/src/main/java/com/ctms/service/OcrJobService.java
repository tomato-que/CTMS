package com.ctms.service;

import com.ctms.common.ResourceNotFoundException;
import com.ctms.common.ErrorCode;
import com.ctms.entity.OcrJob;
import com.ctms.mapper.OcrJobMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class OcrJobService {
    private final OcrJobMapper ocrJobMapper;
    private final RabbitTemplate rabbitTemplate;

    @Transactional
    public OcrJob createAndEnqueue(String fileId, String ocrType) {
        OcrJob job = new OcrJob();
        job.setId(UUID.randomUUID().toString().replace("-", ""));
        job.setFileId(fileId);
        job.setOcrType(ocrType);
        job.setStatus("PENDING");
        ocrJobMapper.insert(job);

        rabbitTemplate.convertAndSend("ctms.tasks.direct", "ocr.request", Map.of(
            "taskId", job.getId(), "taskType", "OCR_PARSE",
            "payload", Map.of("fileId", fileId, "ocrType", ocrType, "ocrJobId", job.getId())
        ));
        return job;
    }

    public OcrJob getById(String id) {
        OcrJob job = ocrJobMapper.selectById(id);
        if (job == null) throw new ResourceNotFoundException(ErrorCode.OCR_JOB_NOT_FOUND);
        return job;
    }

    @Transactional
    public void processCallback(String ocrJobId, String status, String resultJson, String confidenceJson, String modelName, String modelVersion) {
        OcrJob job = ocrJobMapper.selectById(ocrJobId);
        if (job == null) return;
        job.setStatus(status);
        job.setResultJson(resultJson);
        job.setConfidenceJson(confidenceJson);
        job.setModelName(modelName);
        job.setModelVersion(modelVersion);
        ocrJobMapper.updateById(job);
    }
}
