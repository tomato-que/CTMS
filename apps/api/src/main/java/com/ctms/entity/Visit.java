package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import com.ctms.common.BaseEntity;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName("visits")
public class Visit extends BaseEntity {
    private String subjectId;
    private Integer visitNumber;
    private LocalDate plannedDate;
    private LocalDate actualDate;
    private String status;
}
