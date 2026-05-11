package com.ctms.service;

import com.ctms.common.ResourceNotFoundException;
import com.ctms.common.ErrorCode;
import com.ctms.entity.Query;
import com.ctms.enums.QueryStatus;
import com.ctms.mapper.QueryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class QueryService {
    private final QueryMapper queryMapper;

    public Query getById(String id) {
        Query q = queryMapper.selectById(id);
        if (q == null) throw new ResourceNotFoundException(ErrorCode.QUERY_NOT_FOUND);
        return q;
    }

    @Transactional
    public Query create(Query query) {
        query.setStatus(QueryStatus.OPEN.name());
        queryMapper.insert(query);
        return query;
    }

    @Transactional
    public Query updateStatus(String id, QueryStatus status) {
        Query q = getById(id);
        q.setStatus(status.name());
        queryMapper.updateById(q);
        return q;
    }
}
