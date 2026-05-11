package com.ctms.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.ctms.common.ApiResponse;
import com.ctms.entity.Query;
import com.ctms.mapper.QueryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/queries")
@RequiredArgsConstructor
public class QueryController {
    private final QueryMapper queryMapper;

    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<List<Query>> listQueries(@RequestParam(defaultValue = "20") int size) {
        return ApiResponse.success(queryMapper.selectList(
                new LambdaQueryWrapper<Query>().orderByDesc(Query::getCreatedAt).last("LIMIT " + size)));
    }

    @GetMapping("/study/{studyId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_PM','ROLE_CRA','ROLE_CRC','ROLE_PI')")
    public ApiResponse<List<Query>> getStudyQueries(@PathVariable String studyId) {
        return ApiResponse.success(queryMapper.selectList(
                new LambdaQueryWrapper<Query>().eq(Query::getStudyId, studyId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRA')")
    public ApiResponse<Query> createQuery(@RequestBody Query query) {
        query.setStatus("OPEN");
        queryMapper.insert(query);
        return ApiResponse.success(query);
    }

    @PutMapping("/{queryId}/close")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN','ROLE_CRA','ROLE_PI')")
    public ApiResponse<Query> closeQuery(@PathVariable String queryId) {
        Query q = queryMapper.selectById(queryId);
        q.setStatus("CLOSED");
        queryMapper.updateById(q);
        return ApiResponse.success(q);
    }
}
