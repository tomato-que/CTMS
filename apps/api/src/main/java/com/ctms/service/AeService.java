package com.ctms.service;

import com.ctms.common.ResourceNotFoundException;
import com.ctms.common.ErrorCode;
import com.ctms.entity.Ae;
import com.ctms.enums.AeStatus;
import com.ctms.mapper.AeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AeService {
    private final AeMapper aeMapper;

    public Ae getById(String id) {
        Ae ae = aeMapper.selectById(id);
        if (ae == null) throw new ResourceNotFoundException(ErrorCode.AE_NOT_FOUND);
        return ae;
    }

    @Transactional
    public Ae create(Ae ae) {
        ae.setStatus(AeStatus.REPORTED.name());
        aeMapper.insert(ae);
        return ae;
    }
}
