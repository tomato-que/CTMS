package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.entity.Site;
import com.ctms.mapper.SiteMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/sites")
@RequiredArgsConstructor
public class SiteController {
    private final SiteMapper siteMapper;

    @GetMapping("/{siteId}")
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<Site> getSite(@PathVariable String siteId) {
        return ApiResponse.success(siteMapper.selectById(siteId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_ADMIN','ROLE_PM')")
    public ApiResponse<Site> createSite(@RequestBody Site site) {
        siteMapper.insert(site);
        return ApiResponse.success(site);
    }
}
