package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ctms.common.ApiResponse;
import com.ctms.entity.EcrfFormDef;
import com.ctms.mapper.EcrfFormDefMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;

@RestController
@RequestMapping("/api/v1/ecrf/forms")
@RequiredArgsConstructor
public class EcrfFormDefController {

    private final EcrfFormDefMapper formDefMapper;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<List<EcrfFormDef>> list(@RequestParam String studyId) {
        return ApiResponse.success(formDefMapper.selectList(
            new LambdaQueryWrapper<EcrfFormDef>().eq(EcrfFormDef::getStudyId, studyId)));
    }

    @GetMapping("/{formDefId}")
    public ApiResponse<EcrfFormDef> get(@PathVariable String formDefId) {
        return ApiResponse.success(formDefMapper.selectById(formDefId));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<EcrfFormDef> create(@RequestBody EcrfFormDef def) {
        def.setStatus("DRAFT");
        def.setVersionNumber(1);
        formDefMapper.insert(def);
        return ApiResponse.success(def);
    }

    @PutMapping("/{formDefId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<EcrfFormDef> saveSchema(@PathVariable String formDefId, @RequestBody Map<String, Object> body) {
        EcrfFormDef def = formDefMapper.selectById(formDefId);
        if (def == null) return ApiResponse.error(40400, "量表不存在");
        def.setFormSchema((String) body.get("formSchema"));
        def.setFormName((String) body.getOrDefault("formName", def.getFormName()));
        formDefMapper.updateById(def);
        return ApiResponse.success(def);
    }

    @PutMapping("/{formDefId}/publish")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<EcrfFormDef> publish(@PathVariable String formDefId) {
        EcrfFormDef def = formDefMapper.selectById(formDefId);
        if (def == null || !"DRAFT".equals(def.getStatus()))
            return ApiResponse.error(42200, "仅草稿状态可发布");
        def.setStatus("PUBLISHED");
        def.setPublishedAt(java.time.LocalDateTime.now());
        formDefMapper.updateById(def);
        return ApiResponse.success(def);
    }

    @PostMapping("/{formDefId}/clone")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<EcrfFormDef> cloneVersion(@PathVariable String formDefId) {
        EcrfFormDef src = formDefMapper.selectById(formDefId);
        if (src == null) return ApiResponse.error(40400, "量表不存在");
        EcrfFormDef nv = new EcrfFormDef();
        nv.setStudyId(src.getStudyId());
        nv.setFormCode(src.getFormCode());
        nv.setFormName(src.getFormName());
        nv.setFormCategory(src.getFormCategory());
        nv.setVersionNumber(src.getVersionNumber() + 1);
        nv.setFormSchema(src.getFormSchema());
        nv.setStatus("DRAFT");
        formDefMapper.insert(nv);
        return ApiResponse.success(nv);
    }

    @GetMapping("/{formDefId}/versions")
    public ApiResponse<List<EcrfFormDef>> versions(@PathVariable String formDefId) {
        EcrfFormDef def = formDefMapper.selectById(formDefId);
        if (def == null) return ApiResponse.error(40400, "量表不存在");
        return ApiResponse.success(formDefMapper.selectList(
            new LambdaQueryWrapper<EcrfFormDef>()
                .eq(EcrfFormDef::getStudyId, def.getStudyId())
                .eq(EcrfFormDef::getFormCode, def.getFormCode())
                .orderByDesc(EcrfFormDef::getVersionNumber)));
    }
}
