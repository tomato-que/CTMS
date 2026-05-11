package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ctms.common.ApiResponse;
import com.ctms.entity.Ae;
import com.ctms.mapper.AeMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/aes")
@RequiredArgsConstructor
public class AeController {
    private final AeMapper aeMapper;

    @GetMapping("/study/{studyId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<List<Ae>> getStudyAes(@PathVariable String studyId) {
        return ApiResponse.success(aeMapper.selectList(
                new LambdaQueryWrapper<Ae>().eq(Ae::getStudyId, studyId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<Ae> reportAe(@RequestBody Ae ae) {
        aeMapper.insert(ae);
        return ApiResponse.success(ae);
    }
}
