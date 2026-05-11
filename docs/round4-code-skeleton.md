# 十一、代码骨架 (Code Skeleton)

> 最小可运行工程骨架，可直接作为初始工程创建依据。  
> 技术栈：Java 21 + Spring Boot 3 + MyBatis Plus | Python FastAPI | Next.js + TypeScript | Taro + React

---

## 11.1 Java Spring Boot 后端

### 11.1.1 Maven pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.0</version>
    </parent>

    <groupId>com.ctms</groupId>
    <artifactId>ctms-api</artifactId>
    <version>0.1.0-SNAPSHOT</version>
    <name>CTMS API</name>

    <properties>
        <java.version>21</java.version>
        <mybatis-plus.version>3.5.7</mybatis-plus.version>
        <mapstruct.version>1.5.5.Final</mapstruct.version>
        <flowable.version>7.0.1</flowable.version>
        <redisson.version>3.30.0</redisson.version>
        <opensearch.version>2.13.0</opensearch.version>
    </properties>

    <dependencies>
        <!-- Spring Boot Starters -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-validation</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-amqp</artifactId>
        </dependency>

        <!-- Database & ORM -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-redis</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>com.baomidou</groupId>
            <artifactId>mybatis-plus-spring-boot3-starter</artifactId>
            <version>${mybatis-plus.version}</version>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-core</artifactId>
        </dependency>
        <dependency>
            <groupId>org.flywaydb</groupId>
            <artifactId>flyway-database-postgresql</artifactId>
        </dependency>

        <!-- Workflow -->
        <dependency>
            <groupId>org.flowable</groupId>
            <artifactId>flowable-spring-boot-starter</artifactId>
            <version>${flowable.version}</version>
        </dependency>

        <!-- OpenSearch -->
        <dependency>
            <groupId>org.opensearch.client</groupId>
            <artifactId>spring-data-opensearch-starter</artifactId>
            <version>${opensearch.version}</version>
        </dependency>

        <!-- MinIO -->
        <dependency>
            <groupId>io.minio</groupId>
            <artifactId>minio</artifactId>
            <version>8.5.10</version>
        </dependency>

        <!-- JWT -->
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-api</artifactId>
            <version>0.12.6</version>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-impl</artifactId>
            <version>0.12.6</version>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>io.jsonwebtoken</groupId>
            <artifactId>jjwt-jackson</artifactId>
            <version>0.12.6</version>
            <scope>runtime</scope>
        </dependency>

        <!-- Utilities -->
        <dependency>
            <groupId>org.mapstruct</groupId>
            <artifactId>mapstruct</artifactId>
            <version>${mapstruct.version}</version>
        </dependency>
        <dependency>
            <groupId>org.projectlombok</groupId>
            <artifactId>lombok</artifactId>
            <optional>true</optional>
        </dependency>
        <dependency>
            <groupId>org.redisson</groupId>
            <artifactId>redisson-spring-boot-starter</artifactId>
            <version>${redisson.version}</version>
        </dependency>

        <!-- Documentation -->
        <dependency>
            <groupId>org.springdoc</groupId>
            <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
            <version>2.5.0</version>
        </dependency>

        <!-- Observability -->
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-tracing-bridge-otel</artifactId>
        </dependency>
        <dependency>
            <groupId>io.micrometer</groupId>
            <artifactId>micrometer-registry-prometheus</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>

        <!-- Test -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-testcontainers</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>rabbitmq</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
                <configuration>
                    <excludes>
                        <exclude>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                        </exclude>
                    </excludes>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <configuration>
                    <source>21</source>
                    <target>21</target>
                    <annotationProcessorPaths>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok</artifactId>
                            <version>1.18.34</version>
                        </path>
                        <path>
                            <groupId>org.mapstruct</groupId>
                            <artifactId>mapstruct-processor</artifactId>
                            <version>${mapstruct.version}</version>
                        </path>
                        <path>
                            <groupId>org.projectlombok</groupId>
                            <artifactId>lombok-mapstruct-binding</artifactId>
                            <version>0.2.0</version>
                        </path>
                    </annotationProcessorPaths>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.flywaydb</groupId>
                <artifactId>flyway-maven-plugin</artifactId>
                <version>10.15.0</version>
            </plugin>
        </plugins>
    </build>
</project>
```

### 11.1.2 application.yml

```yaml
server:
  port: 8080

spring:
  application:
    name: ctms-api
  datasource:
    url: jdbc:postgresql://${DB_HOST:localhost}:5432/ctms
    username: ${DB_USER:ctms}
    password: ${DB_PASSWORD:ctms_secret}
    driver-class-name: org.postgresql.Driver
    hikari:
      maximum-pool-size: 20
      minimum-idle: 5
      idle-timeout: 300000
      connection-timeout: 10000
  flyway:
    enabled: true
    locations: classpath:db/migration
    baseline-on-migrate: true
  data:
    redis:
      host: ${REDIS_HOST:localhost}
      port: 6379
  rabbitmq:
    host: ${RABBITMQ_HOST:localhost}
    port: 5672
    username: ${RABBITMQ_USER:guest}
    password: ${RABBITMQ_PASS:guest}
    listener:
      simple:
        retry:
          enabled: true
          max-attempts: 3
          initial-interval: 30000
          multiplier: 10.0
  security:
    jwt:
      secret: ${JWT_SECRET:change-me-in-production-min-256-bits}
      access-token-expiration: 900000
      refresh-token-expiration: 28800000

mybatis-plus:
  mapper-locations: classpath*:mapper/**/*.xml
  type-aliases-package: com.ctms.entity
  global-config:
    db-config:
      id-type: ASSIGN_UUID
      logic-delete-field: isDeleted
      logic-delete-value: true
      logic-not-delete-value: false
  configuration:
    map-underscore-to-camel-case: true
    log-impl: org.apache.ibatis.logging.slf4j.Slf4jImpl

minio:
  endpoint: http://${MINIO_HOST:localhost}:9000
  access-key: ${MINIO_ACCESS_KEY:minioadmin}
  secret-key: ${MINIO_SECRET_KEY:minioadmin}
  buckets:
    raw: ctms-raw
    processed: ctms-processed
    archive: ctms-archive
    temp: ctms-temp

opensearch:
  uris: http://${OPENSEARCH_HOST:localhost}:9200
  username: ${OPENSEARCH_USER:admin}
  password: ${OPENSEARCH_PASS:admin}

flowable:
  database-schema-update: true
  async-executor-activate: true
  history-level: audit

springdoc:
  api-docs:
    path: /v3/api-docs
  swagger-ui:
    path: /swagger-ui.html

management:
  endpoints:
    web:
      exposure:
        include: health,info,metrics,prometheus
  metrics:
    export:
      prometheus:
        enabled: true
  tracing:
    sampling:
      probability: 1.0

logging:
  level:
    com.ctms: DEBUG
    org.flywaydb: INFO
  pattern:
    console: "%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] [%X{traceId}] %-5level %logger{36} - %msg%n"
```

### 11.1.3 Spring Boot 启动类

```java
package com.ctms;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableAsync
@EnableScheduling
public class CtmsApplication {

    public static void main(String[] args) {
        SpringApplication.run(CtmsApplication.class, args);
    }
}
```

### 11.1.4 BaseEntity

```java
package com.ctms.common;

import com.baomidou.mybatisplus.annotation.*;
import lombok.Data;
import java.io.Serializable;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
public abstract class BaseEntity implements Serializable {

    @TableId(type = IdType.ASSIGN_UUID)
    private UUID id;

    @TableField(fill = FieldFill.INSERT)
    private ZonedDateTime createdAt;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private ZonedDateTime updatedAt;

    @TableField(fill = FieldFill.INSERT)
    private UUID createdBy;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private UUID updatedBy;

    @TableLogic
    private Boolean isDeleted;

    private ZonedDateTime deletedAt;

    @Version
    private Integer version;
}
```

### 11.1.5 ApiResponse (统一响应)

```java
package com.ctms.common;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.ZonedDateTime;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private int code;
    private String message;
    private T data;
    private String traceId;
    private ZonedDateTime timestamp;

    public static <T> ApiResponse<T> success(T data) {
        return ApiResponse.<T>builder()
                .code(0)
                .message("ok")
                .data(data)
                .traceId(TraceContext.getTraceId())
                .timestamp(ZonedDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> error(int code, String message) {
        return ApiResponse.<T>builder()
                .code(code)
                .message(message)
                .traceId(TraceContext.getTraceId())
                .timestamp(ZonedDateTime.now())
                .build();
    }

    public static <T> ApiResponse<T> error(ErrorCode errorCode) {
        return error(errorCode.getCode(), errorCode.getMessage());
    }
}
```

### 11.1.6 ErrorCode (统一错误码)

```java
package com.ctms.common;

import lombok.Getter;

@Getter
public enum ErrorCode {

    // 通用
    SUCCESS(0, "ok"),
    BAD_REQUEST(40000, "请求参数错误"),
    VALIDATION_ERROR(40001, "参数校验失败"),
    UNAUTHORIZED(40100, "未认证"),
    TOKEN_EXPIRED(40101, "Token已过期"),
    FORBIDDEN(40300, "无权限"),
    NOT_FOUND(40400, "资源不存在"),
    CONFLICT(40900, "资源冲突"),
    INTERNAL_ERROR(50000, "服务器内部错误"),

    // 业务 - Study
    STUDY_NOT_FOUND(40401, "研究项目不存在"),
    STUDY_STATUS_TRANSITION_INVALID(42201, "研究状态流转非法"),
    STUDY_CODE_DUPLICATE(40901, "研究编号重复"),

    // 业务 - Site
    SITE_NOT_FOUND(40402, "中心不存在"),
    SITE_STATUS_TRANSITION_INVALID(42202, "中心状态流转非法"),
    SITE_ALREADY_IN_STUDY(40902, "中心已在该研究中"),

    // 业务 - Subject
    SUBJECT_NOT_FOUND(40403, "受试者不存在"),
    SUBJECT_STATUS_TRANSITION_INVALID(42203, "受试者状态流转非法"),
    SUBJECT_PII_ACCESS_DENIED(40301, "无权访问受试者身份信息"),
    SUBJECT_RANDOMIZATION_FAILED(42204, "随机失败"),

    // 业务 - Visit
    VISIT_NOT_FOUND(40404, "访视不存在"),
    VISIT_OUT_OF_WINDOW(42205, "访视超窗"),
    VISIT_DATA_LOCKED(42301, "访视数据已锁定"),

    // 业务 - Query
    QUERY_NOT_FOUND(40405, "Query不存在"),
    QUERY_ALREADY_CLOSED(42302, "Query已关闭"),

    // 业务 - Safety
    AE_NOT_FOUND(40406, "AE不存在"),
    SAE_NOT_FOUND(40407, "SAE不存在"),
    SAE_ESCALATION_REQUIRED(42303, "SAE需升级上报"),
    SAE_DEADLINE_EXCEEDED(42304, "SAE上报超时"),

    // 业务 - File
    FILE_NOT_FOUND(40408, "文件不存在"),
    FILE_UPLOAD_FAILED(50001, "文件上传失败"),
    FILE_MIME_NOT_ALLOWED(40002, "文件类型不允许"),
    FILE_SIZE_EXCEEDED(40003, "文件大小超限"),

    // 业务 - OCR
    OCR_JOB_NOT_FOUND(40409, "OCR任务不存在"),
    OCR_CONFIDENCE_TOO_LOW(42305, "OCR置信度过低需人工复核"),

    // 业务 - Workflow
    WORKFLOW_INSTANCE_NOT_FOUND(40410, "审批流程不存在"),
    WORKFLOW_APPROVAL_DENIED(42306, "审批已驳回"),

    // 业务 - Export
    EXPORT_APPROVAL_REQUIRED(40302, "导出需审批"),
    EXPORT_IN_PROGRESS(42307, "导出任务进行中"),

    // 系统
    RATE_LIMIT_EXCEEDED(42900, "请求频率超限"),
    SERVICE_UNAVAILABLE(50300, "服务暂不可用");

    private final int code;
    private final String message;

    ErrorCode(int code, String message) {
        this.code = code;
        this.message = message;
    }
}
```

### 11.1.7 GlobalExceptionHandler

```java
package com.ctms.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> handleValidation(MethodArgumentNotValidException ex) {
        String detail = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining("; "));
        log.warn("Validation error: {}", detail);
        return ResponseEntity.badRequest()
                .body(ApiResponse.error(ErrorCode.VALIDATION_ERROR.getCode(), detail));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiResponse<Void>> handleAccessDenied(AccessDeniedException ex) {
        log.warn("Access denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(ApiResponse.error(ErrorCode.FORBIDDEN));
    }

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> handleBusiness(BusinessException ex) {
        log.warn("Business error: {} - {}", ex.getErrorCode(), ex.getMessage());
        return ResponseEntity.unprocessableEntity()
                .body(ApiResponse.error(ex.getErrorCode().getCode(), ex.getMessage()));
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ApiResponse<Void>> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(ApiResponse.error(ex.getErrorCode().getCode(), ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> handleGeneral(Exception ex) {
        log.error("Unexpected error", ex);
        return ResponseEntity.internalServerError()
                .body(ApiResponse.error(ErrorCode.INTERNAL_ERROR));
    }
}
```

### 11.1.8 Spring Security 配置

```java
package com.ctms.config;

import com.ctms.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(cors -> cors.configure(http))
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/login", "/api/v1/auth/refresh").permitAll()
                .requestMatchers("/v3/api-docs/**", "/swagger-ui/**").permitAll()
                .requestMatchers("/actuator/health", "/actuator/prometheus").permitAll()
                .requestMatchers("/api/v1/ocr/callback").permitAll() // AI service internal call
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .anyRequest().authenticated()
            )
            .addFilterBefore(jwtAuthenticationFilter,
                UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}
```

### 11.1.9 JWT 过滤器与工具类

```java
package com.ctms.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.ZonedDateTime;
import java.util.*;

@Slf4j
@Component
public class JwtTokenProvider {

    @Value("${spring.security.jwt.secret}")
    private String jwtSecret;

    @Value("${spring.security.jwt.access-token-expiration}")
    private long accessTokenExpiration;

    @Value("${spring.security.jwt.refresh-token-expiration}")
    private long refreshTokenExpiration;

    private SecretKey key;

    @PostConstruct
    public void init() {
        this.key = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(UUID userId, String username, List<String> roles) {
        return buildToken(userId, username, roles, accessTokenExpiration, "access");
    }

    public String generateRefreshToken(UUID userId, String username) {
        return buildToken(userId, username, Collections.emptyList(),
                refreshTokenExpiration, "refresh");
    }

    private String buildToken(UUID userId, String username,
                               List<String> roles, long expiration, String type) {
        Date now = new Date();
        Date expiry = new Date(now.getTime() + expiration);

        return Jwts.builder()
                .id(UUID.randomUUID().toString())
                .subject(userId.toString())
                .claim("username", username)
                .claim("roles", roles)
                .claim("type", type)
                .issuedAt(now)
                .expiration(expiry)
                .signWith(key)
                .compact();
    }

    public UserPrincipal parseToken(String token) {
        Claims claims = Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();

        return UserPrincipal.builder()
                .userId(UUID.fromString(claims.getSubject()))
                .username(claims.get("username", String.class))
                .roles(claims.get("roles", List.class))
                .build();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
            return true;
        } catch (JwtException e) {
            log.warn("JWT validation failed: {}", e.getMessage());
            return false;
        }
    }
}
```

```java
package com.ctms.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;
    private static final String HEADER = "Authorization";
    private static final String PREFIX = "Bearer ";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                     HttpServletResponse response,
                                     FilterChain filterChain) throws ServletException, IOException {
        String token = extractToken(request);
        if (token != null && jwtTokenProvider.validateToken(token)) {
            UserPrincipal principal = jwtTokenProvider.parseToken(token);
            List<SimpleGrantedAuthority> authorities = principal.getRoles().stream()
                    .map(SimpleGrantedAuthority::new)
                    .toList();

            UsernamePasswordAuthenticationToken auth =
                    new UsernamePasswordAuthenticationToken(principal, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(auth);
        }
        filterChain.doFilter(request, response);
    }

    private String extractToken(HttpServletRequest request) {
        String header = request.getHeader(HEADER);
        if (StringUtils.hasText(header) && header.startsWith(PREFIX)) {
            return header.substring(PREFIX.length());
        }
        return null;
    }
}
```

```java
package com.ctms.security;

import lombok.Builder;
import lombok.Data;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class UserPrincipal {
    private UUID userId;
    private String username;
    private List<String> roles;
}
```

### 11.1.10 审计 AOP

```java
package com.ctms.audit;

import java.lang.annotation.*;

@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface Auditable {
    String operationType();      // STATE_CHANGE, SENSITIVE_ACCESS, EXPORT, etc.
    String targetEntity();
    String targetField() default "";
    String sensitivityLevel() default "S0";
}
```

```java
package com.ctms.audit;

import com.ctms.common.TraceContext;
import com.ctms.security.UserPrincipal;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.time.ZonedDateTime;

@Slf4j
@Aspect
@Component
@RequiredArgsConstructor
public class AuditLogAspect {

    private final AuditLogService auditLogService;
    private final ObjectMapper objectMapper;

    @Around("@annotation(auditable)")
    public Object audit(ProceedingJoinPoint joinPoint, Auditable auditable) throws Throwable {
        Object before = null;
        Object result = null;

        try {
            result = joinPoint.proceed();
            return result;
        } finally {
            try {
                UserPrincipal user = (UserPrincipal) SecurityContextHolder
                        .getContext().getAuthentication().getPrincipal();
                AuditLogEntity log = AuditLogEntity.builder()
                        .traceId(TraceContext.getTraceId())
                        .userId(user.getUserId())
                        .userRole(String.join(",", user.getRoles()))
                        .operationType(auditable.operationType())
                        .targetEntity(auditable.targetEntity())
                        .targetField(auditable.targetField())
                        .sensitivityLevel(auditable.sensitivityLevel())
                        .operationDetail(objectMapper.writeValueAsString(joinPoint.getArgs()))
                        .createdAt(ZonedDateTime.now())
                        .build();
                auditLogService.save(log);
            } catch (Exception e) {
                log.error("Failed to write audit log", e);
            }
        }
    }
}
```

### 11.1.11 Study 模块示例

**Entity:**
```java
package com.ctms.entity;

import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableName;
import com.baomidou.mybatisplus.extension.handlers.JacksonTypeHandler;
import com.ctms.common.BaseEntity;
import com.ctms.enums.StudyStatus;
import lombok.Data;
import lombok.EqualsAndHashCode;
import java.time.LocalDate;

@Data
@EqualsAndHashCode(callSuper = true)
@TableName(value = "studies", autoResultMap = true)
public class Study extends BaseEntity {

    private String studyCode;
    private String title;
    private String shortTitle;
    private String phase;
    private String therapeuticArea;
    private String indication;
    private java.util.UUID sponsorOrgId;
    private java.util.UUID croOrgId;
    private String registrationNumber;
    private StudyStatus status;
    private Integer plannedSites;
    private Integer plannedSubjects;
    private LocalDate actualStartDate;
    private LocalDate actualEndDate;
    private String randomizationRatio;
    private String blindingType;

    @TableField(typeHandler = JacksonTypeHandler.class)
    private String metadataJsonb;
}
```

**Status Enum:**
```java
package com.ctms.enums;

import lombok.Getter;

@Getter
public enum StudyStatus {
    DRAFT("草稿"),
    STARTUP("启动中"),
    ENROLLING("入组中"),
    FOLLOWUP("随访中"),
    LOCKED("已锁定"),
    ARCHIVED("已归档");

    private final String displayName;

    StudyStatus(String displayName) {
        this.displayName = displayName;
    }
}
```

**Mapper:**
```java
package com.ctms.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ctms.entity.Study;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;
import java.util.Map;

@Mapper
public interface StudyMapper extends BaseMapper<Study> {

    // Simple CRUD handled by MyBatis Plus BaseMapper
    // Complex queries → XML Mapper

    List<Study> findStudiesBySponsor(@Param("sponsorOrgId") java.util.UUID sponsorOrgId);

    List<Map<String, Object>> getEnrollmentStats(@Param("studyId") java.util.UUID studyId);

    Integer countActiveSubjects(@Param("studyId") java.util.UUID studyId);
}
```

**XML Mapper:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.ctms.mapper.StudyMapper">

    <select id="findStudiesBySponsor" resultType="com.ctms.entity.Study">
        SELECT s.* FROM studies s
        WHERE s.sponsor_org_id = #{sponsorOrgId}
          AND s.is_deleted = false
        ORDER BY s.created_at DESC
    </select>

    <select id="getEnrollmentStats" resultType="java.util.Map">
        SELECT
            ss.site_status,
            COUNT(sj.id) AS subject_count
        FROM study_sites ss
        LEFT JOIN subjects sj
            ON sj.site_id = ss.site_id
            AND sj.is_deleted = false
        WHERE ss.study_id = #{studyId}
          AND ss.is_deleted = false
        GROUP BY ss.site_status
    </select>

    <select id="countActiveSubjects" resultType="java.lang.Integer">
        SELECT COUNT(*)
        FROM subjects
        WHERE study_id = #{studyId}
          AND is_deleted = false
          AND status NOT IN ('completed', 'withdrawn', 'lost')
    </select>

</mapper>
```

**DTO:**
```java
package com.ctms.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class StudyCreateRequest {
    @NotBlank(message = "研究编号不能为空")
    private String studyCode;

    @NotBlank(message = "研究标题不能为空")
    private String title;

    private String shortTitle;
    private String phase;
    private String therapeuticArea;
    private String indication;
    private String registrationNumber;
    private Integer plannedSites;
    private Integer plannedSubjects;
}
```

```java
package com.ctms.dto.response;

import com.ctms.enums.StudyStatus;
import lombok.Builder;
import lombok.Data;
import java.time.LocalDate;
import java.util.UUID;

@Data
@Builder
public class StudyDetailResponse {
    private UUID id;
    private String studyCode;
    private String title;
    private String shortTitle;
    private String phase;
    private String therapeuticArea;
    private String indication;
    private StudyStatus status;
    private Integer plannedSites;
    private Integer plannedSubjects;
    private Integer actualSubjects;
    private LocalDate actualStartDate;
    private LocalDate actualEndDate;
    private String registrationNumber;
    private String sponsorName;
    private ZonedDateTime created at;
}
```

**Service:**
```java
package com.ctms.service.study;

import com.ctms.audit.Auditable;
import com.ctms.common.BusinessException;
import com.ctms.common.ResourceNotFoundException;
import com.ctms.dto.request.StudyCreateRequest;
import com.ctms.dto.request.StudyStatusTransitionRequest;
import com.ctms.dto.response.StudyDetailResponse;
import com.ctms.entity.Study;
import com.ctms.enums.StudyStatus;
import com.ctms.mapper.StudyMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static com.ctms.common.ErrorCode.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class StudyService {

    private final StudyMapper studyMapper;
    private final StudyStateMachine stateMachine;

    public StudyDetailResponse getById(UUID studyId) {
        Study study = studyMapper.selectById(studyId);
        if (study == null) {
            throw new ResourceNotFoundException(STUDY_NOT_FOUND);
        }
        return toDetailResponse(study);
    }

    @Transactional
    public StudyDetailResponse create(StudyCreateRequest request, UUID userId) {
        // Validate unique study code
        // ...
        Study study = new Study();
        study.setStudyCode(request.getStudyCode());
        study.setTitle(request.getTitle());
        study.setPhase(request.getPhase());
        study.setStatus(StudyStatus.DRAFT);
        study.setCreatedBy(userId);
        study.setUpdatedBy(userId);
        studyMapper.insert(study);
        return toDetailResponse(study);
    }

    @Transactional
    @Auditable(operationType = "STATE_CHANGE", targetEntity = "Study")
    public StudyDetailResponse transitionStatus(UUID studyId,
                                                  StudyStatusTransitionRequest request) {
        Study study = studyMapper.selectById(studyId);
        if (study == null) {
            throw new ResourceNotFoundException(STUDY_NOT_FOUND);
        }
        if (!stateMachine.canTransition(study.getStatus(), request.getTargetStatus())) {
            throw new BusinessException(STUDY_STATUS_TRANSITION_INVALID,
                    "Cannot transition from " + study.getStatus() + " to " + request.getTargetStatus());
        }
        study.setStatus(request.getTargetStatus());
        study.setUpdatedBy(request.getUserId());
        studyMapper.updateById(study);
        return toDetailResponse(study);
    }

    private StudyDetailResponse toDetailResponse(Study study) {
        return StudyDetailResponse.builder()
                .id(study.getId())
                .studyCode(study.getStudyCode())
                .title(study.getTitle())
                .phase(study.getPhase())
                .status(study.getStatus())
                .build();
    }
}
```

**State Machine:**
```java
package com.ctms.service.study;

import com.ctms.enums.StudyStatus;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.Set;

@Component
public class StudyStateMachine {

    private static final Map<StudyStatus, Set<StudyStatus>> ALLOWED_TRANSITIONS = Map.of(
            StudyStatus.DRAFT,     Set.of(StudyStatus.STARTUP, StudyStatus.ARCHIVED),
            StudyStatus.STARTUP,   Set.of(StudyStatus.ENROLLING, StudyStatus.ARCHIVED),
            StudyStatus.ENROLLING, Set.of(StudyStatus.FOLLOWUP),
            StudyStatus.FOLLOWUP,  Set.of(StudyStatus.LOCKED),
            StudyStatus.LOCKED,    Set.of(StudyStatus.ARCHIVED),
            StudyStatus.ARCHIVED,  Set.of()
    );

    public boolean canTransition(StudyStatus from, StudyStatus to) {
        Set<StudyStatus> allowed = ALLOWED_TRANSITIONS.get(from);
        return allowed != null && allowed.contains(to);
    }
}
```

**Controller:**
```java
package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.dto.request.StudyCreateRequest;
import com.ctms.dto.request.StudyStatusTransitionRequest;
import com.ctms.dto.response.StudyDetailResponse;
import com.ctms.security.CurrentUser;
import com.ctms.security.UserPrincipal;
import com.ctms.service.study.StudyService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@Tag(name = "Study Management")
@RestController
@RequestMapping("/api/v1/studies")
@RequiredArgsConstructor
public class StudyController {

    private final StudyService studyService;

    @Operation(summary = "获取项目详情")
    @GetMapping("/{studyId}")
    @PreAuthorize("hasAnyRole('ROLE_PM', 'ROLE_CRA', 'ROLE_CRC', 'ROLE_PI', 'ROLE_SPONSOR')")
    public ApiResponse<StudyDetailResponse> getStudy(@PathVariable UUID studyId) {
        return ApiResponse.success(studyService.getById(studyId));
    }

    @Operation(summary = "创建研究项目")
    @PostMapping
    @PreAuthorize("hasRole('ROLE_PM')")
    public ApiResponse<StudyDetailResponse> createStudy(
            @Valid @RequestBody StudyCreateRequest request,
            @CurrentUser UserPrincipal user) {
        return ApiResponse.success(studyService.create(request, user.getUserId()));
    }

    @Operation(summary = "变更项目状态")
    @PutMapping("/{studyId}/status")
    @PreAuthorize("hasRole('ROLE_PM')")
    public ApiResponse<StudyDetailResponse> transitionStatus(
            @PathVariable UUID studyId,
            @Valid @RequestBody StudyStatusTransitionRequest request) {
        return ApiResponse.success(studyService.transitionStatus(studyId, request));
    }
}
```

### 11.1.12 文件上传模块

```java
package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.dto.request.FileUploadConfirmRequest;
import com.ctms.dto.request.FileUploadUrlRequest;
import com.ctms.dto.response.FileUploadUrlResponse;
import com.ctms.service.document.FileService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    @Operation(summary = "获取预签名上传URL")
    @PostMapping("/upload-url")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<FileUploadUrlResponse> getUploadUrl(
            @Valid @RequestBody FileUploadUrlRequest request) {
        return ApiResponse.success(fileService.generateUploadUrl(request));
    }

    @Operation(summary = "确认上传完成")
    @PostMapping("/{fileId}/confirm")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Void> confirmUpload(
            @PathVariable UUID fileId,
            @Valid @RequestBody FileUploadConfirmRequest request) {
        fileService.confirmUpload(fileId, request);
        return ApiResponse.success(null);
    }
}
```

```java
package com.ctms.service.document;

import com.ctms.dto.request.FileUploadConfirmRequest;
import com.ctms.dto.request.FileUploadUrlRequest;
import com.ctms.dto.response.FileUploadUrlResponse;
import com.ctms.entity.FileObject;
import com.ctms.mapper.FileObjectMapper;
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
    private final RabbitTemplate rabbitTemplate;

    public FileUploadUrlResponse generateUploadUrl(FileUploadUrlRequest request) {
        // Validate MIME
        if (!FileValidator.isAllowedMime(request.getMimeType())) {
            throw new BusinessException(FILE_MIME_NOT_ALLOWED);
        }
        // Validate size
        if (request.getFileSize() > FileValidator.getMaxSize(request.getMimeType())) {
            throw new BusinessException(FILE_SIZE_EXCEEDED);
        }

        String fileId = UUID.randomUUID().toString();
        String objectPath = "upload/" + fileId + "/" + request.getFileName();

        // Create FileObject record (status = UPLOADING)
        FileObject fo = new FileObject();
        fo.setId(UUID.fromString(fileId));
        fo.setOriginalName(request.getFileName());
        fo.setStoragePath(objectPath);
        fo.setBucketName("raw");
        fo.setMimeType(request.getMimeType());
        fo.setFileSize(request.getFileSize());
        fo.setStatus("uploading");
        fo.setBelongEntity(request.getBelongEntity());
        fo.setBelongId(request.getBelongId());
        fileObjectMapper.insert(fo);

        // Generate presigned URL
        String uploadUrl = minioClient.getPresignedObjectUrl(
                GetPresignedObjectUrlArgs.builder()
                        .method(Method.PUT)
                        .bucket("raw")
                        .object(objectPath)
                        .expiry(15, TimeUnit.MINUTES)
                        .build());

        return FileUploadUrlResponse.builder()
                .fileId(fileId)
                .uploadUrl(uploadUrl)
                .expiresIn(900)
                .build();
    }

    public void confirmUpload(UUID fileId, FileUploadConfirmRequest request) {
        FileObject fo = fileObjectMapper.selectById(fileId);
        if (fo == null) {
            throw new ResourceNotFoundException(FILE_NOT_FOUND);
        }

        // Verify hash
        String actualHash = minioClient... // calculate SHA-256
        if (!actualHash.equals(request.getFileHash())) {
            fo.setStatus("failed");
            fileObjectMapper.updateById(fo);
            throw new BusinessException(FILE_UPLOAD_FAILED, "Hash mismatch");
        }

        fo.setFileHash(request.getFileHash());
        fo.setStatus("uploaded");
        fileObjectMapper.updateById(fo);

        // Enqueue async scan + OCR task
        rabbitTemplate.convertAndSend("ctms.tasks.direct", "file.scan",
                buildScanMessage(fileId));
    }
}
```

### 11.1.13 RabbitMQ OCR 任务 + 回调

**Producer:**
```java
package com.ctms.integration.message;

import lombok.RequiredArgsConstructor;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OcrTaskProducer {

    private final RabbitTemplate rabbitTemplate;

    public void enqueueOcrTask(UUID fileId, UUID ocrJobId, String ocrType) {
        Map<String, Object> message = Map.of(
                "taskId", ocrJobId.toString(),
                "taskType", "OCR_PARSE",
                "traceId", TraceContext.getTraceId(),
                "idempotencyKey", "ocr|" + fileId + "|v1",
                "payload", Map.of(
                        "fileId", fileId.toString(),
                        "ocrType", ocrType
                )
        );
        rabbitTemplate.convertAndSend("ctms.tasks.direct", "ocr.request", message);
    }
}
```

**Callback Controller:**
```java
package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.dto.request.OcrCallbackRequest;
import com.ctms.service.ai.OcrCallbackService;
import io.swagger.v3.oas.annotations.Operation;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;

@Slf4j
@RestController
@RequestMapping("/api/v1/ocr")
@RequiredArgsConstructor
public class OcrController {

    private final OcrCallbackService ocrCallbackService;

    @Operation(summary = "AI OCR回调 (internal)")
    @PostMapping("/callback")
    public ApiResponse<Void> ocrCallback(@Valid @RequestBody OcrCallbackRequest request) {
        log.info("OCR callback received: jobId={}, status={}", request.getOcrJobId(), request.getStatus());
        ocrCallbackService.processCallback(request);
        return ApiResponse.success(null);
    }

    @Operation(summary = "人工确认OCR结果")
    @PutMapping("/{ocrJobId}/confirm")
    @PreAuthorize("hasAnyRole('ROLE_CRC', 'ROLE_PI')")
    public ApiResponse<Void> confirmOcrResult(
            @PathVariable UUID ocrJobId,
            @Valid @RequestBody OcrConfirmRequest request) {
        ocrCallbackService.confirmResult(ocrJobId, request);
        return ApiResponse.success(null);
    }
}
```

```java
package com.ctms.service.ai;

import com.ctms.audit.Auditable;
import com.ctms.dto.request.OcrCallbackRequest;
import com.ctms.dto.request.OcrConfirmRequest;
import com.ctms.entity.*;
import com.ctms.mapper.*;
import com.ctms.service.notification.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class OcrCallbackService {

    private final OcrJobMapper ocrJobMapper;
    private final DiagnosticReportMapper diagnosticReportMapper;
    private final ObservationMapper observationMapper;
    private final NotificationService notificationService;

    @Transactional
    public void processCallback(OcrCallbackRequest request) {
        OcrJob job = ocrJobMapper.selectById(UUID.fromString(request.getOcrJobId()));
        if (job == null) return;

        job.setStatus("completed");
        job.setResultJsonb(request.getResultJson());
        job.setConfidenceScoresJsonb(request.getConfidenceScores());
        job.setModelName(request.getModelName());
        job.setModelVersion(request.getModelVersion());
        job.setCompletedAt(ZonedDateTime.now());
        ocrJobMapper.updateById(job);

        // Create DiagnosticReport / Observations (status = PENDING_REVIEW)
        createObservationsFromOcr(job, request);

        // Notify CRC
        notificationService.notifyOcrReady(job);
    }

    @Transactional
    @Auditable(operationType = "AI_CONFIRMATION", targetEntity = "OCRJob")
    public void confirmResult(UUID ocrJobId, OcrConfirmRequest request) {
        // Update OCRJob status to CONFIRMED
        // Apply corrections from CRC
        // Finalize DiagnosticReport / Observation records
        // Audit log everything
    }
}
```

### 11.1.14 异步任务状态查询

```java
package com.ctms.controller;

import com.ctms.common.ApiResponse;
import com.ctms.dto.response.TaskStatusResponse;
import com.ctms.service.integration.IntegrationTaskService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final IntegrationTaskService taskService;

    @GetMapping("/{taskId}/status")
    public ApiResponse<TaskStatusResponse> getTaskStatus(@PathVariable UUID taskId) {
        return ApiResponse.success(taskService.getStatus(taskId));
    }
}
```

---

## 11.2 Python FastAPI AI/OCR 服务

### 11.2.1 main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from config import settings
from routers import ocr, extraction, qa, summary, risk, prediction
from model_registry.registry import ModelRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Service starting...")
    ModelRegistry.load_models()
    logger.info(f"Registered models: {ModelRegistry.list_models()}")
    yield
    logger.info("AI Service shutting down...")

app = FastAPI(
    title="CTMS AI/OCR Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr.router, prefix="/ocr", tags=["OCR"])
app.include_router(extraction.router, prefix="/extract", tags=["Extraction"])
app.include_router(qa.router, prefix="/qa", tags=["Q&A"])
app.include_router(summary.router, prefix="/summary", tags=["Summary"])
app.include_router(risk.router, prefix="/risk", tags=["Risk"])
app.include_router(prediction.router, prefix="/predict", tags=["Prediction"])

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ctms-ai-service"}

@app.get("/model/version")
async def model_versions():
    return {"models": ModelRegistry.list_models()}
```

### 11.2.2 config.py

```python
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    app_name: str = "ctms-ai-service"
    debug: bool = False

    # Java API callback
    java_api_base_url: str = "http://api:8080"
    java_api_callback_path: str = "/api/v1/ocr/callback"
    callback_retry_max: int = 3
    callback_retry_delay: int = 5

    # RabbitMQ
    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "guest"
    rabbitmq_pass: str = "guest"
    ocr_request_queue: str = "ctms.ocr.request"

    # MinIO
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minioadmin"
    minio_raw_bucket: str = "ctms-raw"
    minio_processed_bucket: str = "ctms-processed"

    # OpenSearch
    opensearch_hosts: str = "http://opensearch:9200"
    opensearch_user: str = "admin"
    opensearch_pass: str = "admin"
    opensearch_index_kb: str = "idx_knowledge_base"

    # Model paths
    paddleocr_model_dir: str = "/models/paddleocr"
    paddlex_model_dir: str = "/models/paddlex"
    embedding_model_name: str = "BAAI/bge-large-zh-v1.5"

    # LLM
    llm_api_base: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model_name: str = "default"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

settings = Settings()
```

### 11.2.3 OCR Router

```python
from fastapi import APIRouter, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional
import uuid

from services.ocr_service import OcrService
from callback.client import CallbackClient
from model_registry.registry import ModelRegistry

router = APIRouter()
ocr_service = OcrService()
callback_client = CallbackClient()

class OcrParseRequest(BaseModel):
    file_id: str = Field(..., description="MinIO file ID")
    ocr_type: str = Field(default="LAB_REPORT", description="Document type")
    ocr_job_id: str = Field(..., description="OCR job ID")
    callback_url: Optional[str] = None

class OcrParseResponse(BaseModel):
    job_id: str
    status: str

@router.post("/parse", response_model=OcrParseResponse)
async def parse_document(request: OcrParseRequest, background_tasks: BackgroundTasks):
    """OCR document parsing endpoint"""
    background_tasks.add_task(
        ocr_service.process,
        file_id=request.file_id,
        ocr_type=request.ocr_type,
        ocr_job_id=request.ocr_job_id,
        callback_url=request.callback_url,
    )
    return OcrParseResponse(job_id=request.ocr_job_id, status="queued")

@router.post("/batch")
async def parse_batch(requests: list[OcrParseRequest], background_tasks: BackgroundTasks):
    """Batch OCR parsing"""
    for req in requests:
        background_tasks.add_task(
            ocr_service.process,
            file_id=req.file_id,
            ocr_type=req.ocr_type,
            ocr_job_id=req.ocr_job_id,
        )
    return {"accepted": len(requests)}
```

### 11.2.4 OCR Service

```python
import json
import logging
import uuid
from datetime import datetime, timezone

from engines.paddle_ocr import PaddleOcrEngine
from engines.paddle_x import PaddleXPipeline
from engines.llm_adapter import LLMAdapter
from utils.unit_normalizer import UnitNormalizer
from utils.confidence import ConfidenceScorer
from utils.text_cleaner import TextCleaner
from callback.client import CallbackClient
from model_registry.registry import ModelRegistry

logger = logging.getLogger(__name__)

class OcrService:
    def __init__(self):
        self.ocr_engine = PaddleOcrEngine()
        self.paddlex = PaddleXPipeline()
        self.llm = LLMAdapter()
        self.normalizer = UnitNormalizer()
        self.scorer = ConfidenceScorer()
        self.cleaner = TextCleaner()
        self.callback = CallbackClient()

    async def process(self, file_id: str, ocr_type: str,
                      ocr_job_id: str, callback_url: str = None):
        """Complete OCR pipeline"""
        try:
            # 1. Download file from MinIO
            file_bytes = self._download_from_minio(file_id)

            # 2. Run PaddleOCR
            ocr_raw = self.ocr_engine.recognize(file_bytes)

            # 3. Run PaddleX pipeline for structured extraction
            structured = self.paddlex.extract(file_bytes, ocr_type, ocr_raw)

            # 4. Clean and normalize
            fields = []
            for item in structured.get("fields", []):
                cleaned_value = self.cleaner.clean(item["extracted_value"])
                normalized = self.normalizer.normalize(
                    cleaned_value, item.get("unit"), item.get("field_name")
                )
                confidence = self.scorer.calculate_field_confidence(
                    item, ocr_raw, normalized
                )
                abnormal = self._check_abnormal(normalized, item.get("reference_range"))
                fields.append({
                    "field_name": item["field_name"],
                    "field_type": item.get("field_type", "text"),
                    "extracted_value": cleaned_value,
                    "unit": item.get("unit"),
                    "normalized_value": normalized.get("value"),
                    "normalized_unit": normalized.get("unit"),
                    "confidence_score": confidence,
                    "reference_range": item.get("reference_range"),
                    "abnormal_flag": abnormal,
                })

            # 4. Build result
            result = {
                "document_type": ocr_type,
                "fields": fields,
                "tables": structured.get("tables", []),
                "overall_confidence": self.scorer.calculate_overall_confidence(fields),
            }

            # 5. Record model version
            model_info = ModelRegistry.get_active_model("ocr-lab-report")

            # 6. Callback to Java API
            callback_payload = {
                "ocr_job_id": ocr_job_id,
                "status": "completed",
                "result_json": json.dumps(result),
                "confidence_scores": json.dumps({
                    f["field_name"]: f["confidence_score"] for f in fields
                }),
                "model_name": model_info["model_name"],
                "model_version": model_info["version"],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }
            await self.callback.send(callback_payload, callback_url)

        except Exception as e:
            logger.error(f"OCR processing failed: {file_id} - {e}")
            # Send failure callback
            await self.callback.send({
                "ocr_job_id": ocr_job_id,
                "status": "failed",
                "error_detail": str(e),
            }, callback_url)

    def _download_from_minio(self, file_id: str) -> bytes:
        from minio import Minio
        from config import settings
        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False,
        )
        # Find object by file_id metadata
        # ...
        return b""  # placeholder

    def _check_abnormal(self, normalized: dict, reference_range: str) -> str:
        """Check if value is outside reference range"""
        # Parse reference range, compare with normalized value
        # Return: N (normal), L (low), H (high), LL (critically low), HH (critically high)
        return "N"
```

### 11.2.5 PaddleOCR Engine (placeholder)

```python
import logging

logger = logging.getLogger(__name__)

class PaddleOcrEngine:
    """PaddleOCR wrapper - replace with actual PaddleOCR initialization"""

    def __init__(self):
        try:
            from paddleocr import PaddleOCR
            self.ocr = PaddleOCR(
                use_angle_cls=True,
                lang="ch",
                use_gpu=True,
                show_log=False,
            )
            self.available = True
            logger.info("PaddleOCR initialized successfully")
        except ImportError:
            self.ocr = None
            self.available = False
            logger.warning("PaddleOCR not installed - using mock")

    def recognize(self, image_bytes: bytes) -> dict:
        """Run OCR on image, return raw result"""
        if not self.available:
            return self._mock_recognize(image_bytes)

        import numpy as np
        from PIL import Image
        import io
        image = Image.open(io.BytesIO(image_bytes))
        image_np = np.array(image)
        result = self.ocr.ocr(image_np, cls=True)
        return {"raw_ocr": result}

    def _mock_recognize(self, image_bytes: bytes) -> dict:
        return {"raw_ocr": [], "status": "mock"}
```

### 11.2.6 Unit Normalizer

```python
import re
from typing import Optional

class UnitNormalizer:
    """Medical unit standardization"""

    # Common unit mappings
    UNIT_MAP = {
        "mg/dL": {"si_unit": "mmol/L", "factor": None},  # substance-dependent
        "mmol/L": {"si_unit": "mmol/L", "factor": 1.0},
        "g/L": {"si_unit": "g/L", "factor": 1.0},
        "x10^9/L": {"si_unit": "10^9/L", "factor": 1.0},
        "x10^12/L": {"si_unit": "10^12/L", "factor": 1.0},
        "mm[Hg]": {"si_unit": "mm[Hg]", "factor": 1.0},
        "mmHg": {"si_unit": "mm[Hg]", "factor": 1.0},
        "mm/Hg": {"si_unit": "mm[Hg]", "factor": 1.0},
        "U/L": {"si_unit": "U/L", "factor": 1.0},
        "IU/L": {"si_unit": "U/L", "factor": 1.0},
        "ng/mL": {"si_unit": "ng/mL", "factor": 1.0},
        "ug/L": {"si_unit": "μg/L", "factor": 1.0},
        "mL/min": {"si_unit": "mL/min", "factor": 1.0},
        "mL/min/1.73m2": {"si_unit": "mL/min/1.73m²", "factor": 1.0},
        "%": {"si_unit": "%", "factor": 1.0},
    }

    # Unit aliases
    UNIT_ALIASES = {
        "mmhg": "mm[Hg]",
        "mm hg": "mm[Hg]",
        "x10^9/l": "10^9/L",
        "x109/l": "10^9/L",
        "10*9/l": "10^9/L",
        "g/l": "g/L",
        "u/l": "U/L",
        "iu/l": "U/L",
    }

    def normalize(self, value: str, unit: Optional[str],
                  field_name: str) -> dict:
        """Normalize value and unit"""
        if unit is None:
            return {"value": value, "unit": None}

        # Normalize unit
        clean_unit = unit.strip().lower()
        clean_unit = self.UNIT_ALIASES.get(clean_unit, clean_unit)

        # Parse numeric value
        numeric_value = self._parse_numeric(value)
        if numeric_value is None:
            return {"value": value, "unit": clean_unit, "status": "non_numeric"}

        return {"value": numeric_value, "unit": clean_unit, "status": "normalized"}

    def _parse_numeric(self, value: str) -> Optional[float]:
        try:
            cleaned = re.sub(r'[^0-9.\-]', '', str(value))
            return float(cleaned) if cleaned else None
        except (ValueError, TypeError):
            return None
```

### 11.2.7 Confidence Scorer

```python
from typing import List

class ConfidenceScorer:
    """Multi-level confidence scoring"""

    CHAR_WEIGHT = 0.3
    WORD_WEIGHT = 0.3
    CONTEXT_WEIGHT = 0.2
    TEMPLATE_WEIGHT = 0.2

    HIGH_THRESHOLD = 0.95
    MEDIUM_THRESHOLD = 0.80

    def calculate_field_confidence(self, field: dict, ocr_raw: dict,
                                   normalized: dict) -> float:
        """Calculate per-field confidence score"""
        char_score = self._char_level_confidence(field, ocr_raw)
        word_score = self._word_level_confidence(field)
        context_score = self._context_confidence(field, normalized)
        template_score = self._template_match_confidence(field)

        return (
            self.CHAR_WEIGHT * char_score
            + self.WORD_WEIGHT * word_score
            + self.CONTEXT_WEIGHT * context_score
            + self.TEMPLATE_WEIGHT * template_score
        )

    def calculate_overall_confidence(self, fields: List[dict]) -> float:
        if not fields:
            return 0.0
        return sum(f["confidence_score"] for f in fields) / len(fields)

    def get_confidence_level(self, score: float) -> str:
        if score >= self.HIGH_THRESHOLD:
            return "HIGH"
        elif score >= self.MEDIUM_THRESHOLD:
            return "MEDIUM"
        return "LOW"

    def _char_level_confidence(self, field: dict, ocr_raw: dict) -> float:
        return 0.95  # placeholder

    def _word_level_confidence(self, field: dict) -> float:
        return 0.93  # placeholder

    def _context_confidence(self, field: dict, normalized: dict) -> float:
        return 0.90  # placeholder

    def _template_match_confidence(self, field: dict) -> float:
        return 0.90  # placeholder
```

### 11.2.8 Model Registry

```python
import json
import os
from datetime import datetime, timezone
from typing import Optional

class ModelRegistry:
    """Central model version tracking"""

    _models: dict = {}
    _registry_file = "/models/metadata.json"

    @classmethod
    def load_models(cls):
        """Load model metadata from registry file"""
        if os.path.exists(cls._registry_file):
            with open(cls._registry_file, "r") as f:
                data = json.load(f)
                cls._models = {m["model_name"]: m for m in data.get("models", [])}

    @classmethod
    def get_active_model(cls, model_name: str) -> Optional[dict]:
        """Get currently active model version"""
        return cls._models.get(model_name)

    @classmethod
    def register_model(cls, model_name: str, version: str,
                       model_type: str, performance_metrics: dict):
        """Register a new model version"""
        cls._models[model_name] = {
            "model_name": model_name,
            "version": version,
            "model_type": model_type,
            "deployed_at": datetime.now(timezone.utc).isoformat(),
            "performance_metrics": performance_metrics,
            "status": "active",
        }
        cls._persist()

    @classmethod
    def list_models(cls) -> list:
        return [
            {
                "model_name": m["model_name"],
                "version": m["version"],
                "status": m["status"],
                "deployed_at": m["deployed_at"],
            }
            for m in cls._models.values()
        ]

    @classmethod
    def _persist(cls):
        os.makedirs(os.path.dirname(cls._registry_file), exist_ok=True)
        with open(cls._registry_file, "w") as f:
            json.dump({"models": list(cls._models.values())}, f, indent=2, default=str)
```

### 11.2.9 Callback Client

```python
import httpx
import logging
from config import settings

logger = logging.getLogger(__name__)

class CallbackClient:
    """HTTP callback to Java API"""

    def __init__(self):
        self.base_url = settings.java_api_base_url
        self.callback_path = settings.java_api_callback_path
        self.max_retries = settings.callback_retry_max
        self.retry_delay = settings.callback_retry_delay

    async def send(self, payload: dict, callback_url: str = None) -> bool:
        """Send callback to Java API with retries"""
        url = callback_url or f"{self.base_url}{self.callback_path}"

        async with httpx.AsyncClient(timeout=30.0) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(url, json=payload)
                    if response.status_code == 200:
                        logger.info(f"Callback succeeded: {payload.get('ocr_job_id')}")
                        return True
                    logger.warning(f"Callback attempt {attempt + 1} failed: {response.status_code}")
                except Exception as e:
                    logger.error(f"Callback attempt {attempt + 1} error: {e}")

                if attempt < self.max_retries - 1:
                    import asyncio
                    await asyncio.sleep(self.retry_delay * (attempt + 1))

            logger.error(f"Callback exhausted retries: {payload.get('ocr_job_id')}")
            return False
```

---

## 11.3 Next.js 管理端

### 11.3.1 app/layout.tsx

```tsx
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { Providers } from "@/components/providers";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CTMS - 临床研究项目运营管理平台",
  description: "Clinical Trial Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: "#1677ff",
                borderRadius: 6,
              },
            }}
          >
            <Providers>{children}</Providers>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
```

### 11.3.2 工作台骨架

```tsx
// app/(main)/workspace/page.tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, Col, Row, Statistic, Table, Tag, Spin, Alert } from "antd";
import {
  UserAddOutlined,
  FileTextOutlined,
  AlertOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { PageHeader } from "@/components/shared/PageHeader";
import { EnrollmentChart } from "@/components/workspace/EnrollmentChart";
import { StudyPhaseDistribution } from "@/components/workspace/StudyPhaseDistribution";
import { KeyProjectTracking } from "@/components/workspace/KeyProjectTracking";
import { MyTodos } from "@/components/workspace/MyTodos";
import { usePermission } from "@/hooks/usePermission";
import { apiClient } from "@/lib/api-client";

export default function WorkspacePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["workspace"],
    queryFn: () => apiClient.get("/api/v1/dashboard/pm-workspace"),
  });

  const { can } = usePermission();

  if (isLoading) return <Spin size="large" />;
  if (error) return <Alert type="error" message="Failed to load workspace" />;

  return (
    <>
      <PageHeader title="工作台" subtitle="项目概览与待办" />
      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="活跃项目"
              value={data?.activeStudies ?? 0}
              prefix={<FileTextOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月入组"
              value={data?.monthlyEnrollments ?? 0}
              prefix={<UserAddOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="待处理Query"
              value={data?.pendingQueries ?? 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: data?.pendingQueries > 10 ? "#cf1322" : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="本月访视完成率"
              value={data?.visitCompletionRate ?? 0}
              suffix="%"
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={16}>
          <Card title="受试者入组趋势">
            <EnrollmentChart data={data?.enrollmentTrend} />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="项目运行阶段分布">
            <StudyPhaseDistribution data={data?.phaseDistribution} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={14}>
          <Card title="重点项目跟踪">
            <KeyProjectTracking data={data?.keyProjects} />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="我的待办">
            <MyTodos data={data?.todos} />
          </Card>
        </Col>
      </Row>
    </>
  );
}
```

### 11.3.3 权限按钮示例

```tsx
// components/auth/Access.tsx
"use client";

import { usePermission } from "@/hooks/usePermission";
import type { ReactNode } from "react";

interface AccessProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function Access({ permission, children, fallback = null }: AccessProps) {
  const { can } = usePermission();
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

// Usage:
// <Access permission="subject:viewPii">
//   <Button>查看身份信息</Button>
// </Access>
```

### 11.3.4 API Client

```typescript
// lib/api-client.ts
import axios from "axios";

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080",
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers["X-Trace-Id"] = generateTraceId();
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    if (error.response?.status === 401) {
      // Try refresh token
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return apiClient.request(error.config);
      }
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export { apiClient };
```

---

## 11.4 Taro 患者端

### 11.4.1 首页骨架

```tsx
// src/pages/index/index.tsx
import { View, Text, ScrollView } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import Taro from "@tarojs/taro";
import { Card, Statistic, Tag } from "@/components";
import { useUserAuth } from "@/hooks/useUserAuth";
import { apiClient } from "@/utils/api-client";
import "./index.scss";

interface HomeData {
  nextVisit?: { date: string; type: string; window: string };
  pendingQuestionnaires: number;
  pendingUploads: number;
  notifications: Array<{ title: string; time: string }>;
  studyInfo: { name: string; phase: string };
}

export default function HomePage() {
  const { userType } = useUserAuth();
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    loadHomeData();
  });

  const loadHomeData = async () => {
    try {
      const res = await apiClient.get("/api/v1/patient/home");
      setHomeData(res.data);
    } catch (e) {
      Taro.showToast({ title: "加载失败", icon: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <View className="loading">加载中...</View>;
  }

  return (
    <ScrollView className="home-page">
      {/* Study Info */}
      <Card className="study-card">
        <Text className="study-name">{homeData?.studyInfo?.name}</Text>
        <Tag>{homeData?.studyInfo?.phase}</Tag>
      </Card>

      {/* Next Visit */}
      {homeData?.nextVisit && (
        <Card
          className="visit-card"
          onClick={() => Taro.navigateTo({ url: "/pages/calendar/index" })}
        >
          <Text className="card-title">下次访视</Text>
          <View className="visit-detail">
            <Text className="visit-date">{homeData.nextVisit.date}</Text>
            <Text className="visit-type">{homeData.nextVisit.type}</Text>
            <Text className="visit-window">窗口期: {homeData.nextVisit.window}</Text>
          </View>
        </Card>
      )}

      {/* Action Cards */}
      <View className="action-row">
        <Card
          className="action-card"
          onClick={() => Taro.navigateTo({ url: "/sub-pages/questionnaire/index" })}
        >
          <Text className="action-title">待填问卷</Text>
          <Text className="action-count">{homeData?.pendingQuestionnaires ?? 0}</Text>
        </Card>

        <Card
          className="action-card"
          onClick={() => Taro.navigateTo({ url: "/pages/upload/index" })}
        >
          <Text className="action-title">待上传报告</Text>
          <Text className="action-count">{homeData?.pendingUploads ?? 0}</Text>
        </Card>
      </View>

      {/* Notifications */}
      <View className="notifications">
        <Text className="section-title">消息</Text>
        {homeData?.notifications?.map((n, i) => (
          <View key={i} className="notification-item">
            <Text className="notif-title">{n.title}</Text>
            <Text className="notif-time">{n.time}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
```

### 11.4.2 上传页骨架

```tsx
// src/pages/upload/index.tsx
import { View, Text, Image, Button } from "@tarojs/components";
import { useState } from "react";
import Taro from "@tarojs/taro";
import { apiClient } from "@/utils/api-client";
import { useOcrPolling } from "@/hooks/useOcrPolling";

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [ocrJobId, setOcrJobId] = useState<string | null>(null);
  const { status: ocrStatus, result: ocrResult } = useOcrPolling(ocrJobId);

  const handleSelectFile = async () => {
    const res = await Taro.chooseMessageFile({
      count: 1,
      type: "file",
      extension: ["pdf", "jpg", "jpeg", "png"],
    });
    const file = res.tempFiles[0];
    await uploadFile(file);
  };

  const handleTakePhoto = async () => {
    const res = await Taro.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["camera"],
    });
    if (res.tempFilePaths.length > 0) {
      await uploadFile({ path: res.tempFilePaths[0], name: "photo.jpg", size: 0 });
    }
  };

  const uploadFile = async (file: { path: string; name: string; size: number }) => {
    setUploading(true);
    try {
      // Step 1: Get presigned URL
      const { data: uploadInfo } = await apiClient.post("/api/v1/files/upload-url", {
        fileName: file.name,
        mimeType: "image/jpeg",
        fileSize: file.size,
        belongEntity: "subject",
      });

      // Step 2: Upload to MinIO
      await Taro.uploadFile({
        url: uploadInfo.uploadUrl,
        filePath: file.path,
        name: "file",
      });

      // Step 3: Confirm upload
      await apiClient.post(`/api/v1/files/${uploadInfo.fileId}/confirm`, {
        fileHash: "",
      });

      // Step 4: Start OCR polling
      setOcrJobId(uploadInfo.fileId);

      Taro.showToast({ title: "上传成功，正在识别...", icon: "success" });
    } catch (e) {
      Taro.showToast({ title: "上传失败", icon: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <View className="upload-page">
      <Text className="page-title">报告上传</Text>

      <View className="upload-actions">
        <Button onClick={handleSelectFile} loading={uploading}>
          从聊天记录选择
        </Button>
        <Button onClick={handleTakePhoto} loading={uploading}>
          拍照
        </Button>
      </View>

      {ocrStatus === "processing" && (
        <View className="ocr-status">
          <Text>正在识别中...</Text>
        </View>
      )}

      {ocrStatus === "completed" && (
        <View className="ocr-result">
          <Text className="result-title">识别结果</Text>
          {ocrResult?.fields?.map((field: any, i: number) => (
            <View key={i} className={`ocr-field confidence-${field.confidence_level}`}>
              <Text className="field-name">{field.field_name}</Text>
              <Text className="field-value">
                {field.normalized_value} {field.normalized_unit}
              </Text>
              {field.abnormal_flag !== "N" && (
                <Text className="abnormal-tag">{field.abnormal_flag}</Text>
              )}
            </View>
          ))}
          <Button
            type="primary"
            onClick={() =>
              Taro.navigateTo({
                url: `/sub-pages/ocr-confirm/index?jobId=${ocrJobId}`,
              })
            }
          >
            确认结果
          </Button>
        </View>
      )}
    </View>
  );
}
```

### 11.4.3 OCR 轮询 Hook

```typescript
// hooks/useOcrPolling.ts
import { useState, useEffect, useRef } from "react";
import { apiClient } from "@/utils/api-client";

interface OcrStatus {
  status: "pending" | "queued" | "processing" | "completed" | "failed" | "confirmed";
  result?: any;
}

export function useOcrPolling(ocrJobId: string | null) {
  const [status, setStatus] = useState<string>("idle");
  const [result, setResult] = useState<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!ocrJobId) return;

    const poll = async () => {
      try {
        const { data } = await apiClient.get(`/api/v1/ocr/${ocrJobId}/status`);
        setStatus(data.status);
        if (data.status === "completed") {
          const { data: resultData } = await apiClient.get(
            `/api/v1/ocr/${ocrJobId}/result`
          );
          setResult(resultData);
          clearInterval(intervalRef.current!);
        }
        if (data.status === "failed") {
          clearInterval(intervalRef.current!);
        }
      } catch (e) {
        // Retry on next interval
      }
    };

    poll(); // Immediate first poll
    intervalRef.current = setInterval(poll, 3000); // Poll every 3 seconds

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [ocrJobId]);

  return { status, result };
}
```

---

## 11.5 Docker Compose

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: ctms-postgres
    environment:
      POSTGRES_DB: ctms
      POSTGRES_USER: ctms
      POSTGRES_PASSWORD: ctms_secret
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ctms"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: ctms-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      retries: 5

  rabbitmq:
    image: rabbitmq:3-management-alpine
    container_name: ctms-rabbitmq
    environment:
      RABBITMQ_DEFAULT_USER: guest
      RABBITMQ_DEFAULT_PASS: guest
    ports:
      - "5672:5672"
      - "15672:15672"
    healthcheck:
      test: ["CMD", "rabbitmqctl", "status"]
      interval: 30s
      timeout: 10s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: ctms-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      retries: 3

  minio-init:
    image: minio/mc:latest
    container_name: ctms-minio-init
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      mc alias set ctms http://minio:9000 minioadmin minioadmin;
      mc mb --ignore-existing ctms/ctms-raw;
      mc mb --ignore-existing ctms/ctms-processed;
      mc mb --ignore-existing ctms/ctms-archive;
      mc mb --ignore-existing ctms/ctms-temp;
      "

  opensearch:
    image: opensearchproject/opensearch:2.14.0
    container_name: ctms-opensearch
    environment:
      discovery.type: single-node
      OPENSEARCH_INITIAL_ADMIN_PASSWORD: Admin123!
      DISABLE_SECURITY_PLUGIN: "true"
    ports:
      - "9200:9200"
    volumes:
      - osdata:/usr/share/opensearch/data

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    container_name: ctms-api
    ports:
      - "8080:8080"
    environment:
      DB_HOST: postgres
      DB_USER: ctms
      DB_PASSWORD: ctms_secret
      REDIS_HOST: redis
      RABBITMQ_HOST: rabbitmq
      MINIO_HOST: minio
      OPENSEARCH_HOST: opensearch
      JWT_SECRET: dev-secret-key-change-in-production-use-256-bits
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy
      opensearch:
        condition: service_started

  ai-service:
    build:
      context: ./apps/ai-service
      dockerfile: Dockerfile
    container_name: ctms-ai-service
    ports:
      - "8000:8000"
    environment:
      JAVA_API_BASE_URL: http://api:8080
      RABBITMQ_HOST: rabbitmq
      MINIO_ENDPOINT: minio:9000
      OPENSEARCH_HOSTS: http://opensearch:9200
    depends_on:
      rabbitmq:
        condition: service_healthy
      minio:
        condition: service_healthy

  admin-web:
    build:
      context: ./apps/admin-web
      dockerfile: Dockerfile
    container_name: ctms-admin-web
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8080
    depends_on:
      - api

volumes:
  pgdata:
  miniodata:
  osdata:
```

### Dockerfiles

**Java API Dockerfile:**
```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY target/ctms-api-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

**Python AI Service Dockerfile:**
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Next.js Admin Web Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package*.json ./
RUN npm ci --production
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 11.6 GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm install -g pnpm
      - run: pnpm lint

  test-java:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with: { java-version: "21", distribution: "temurin" }
      - run: cd apps/api && ./mvnw test

  test-python:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.12" }
      - run: cd apps/ai-service && pip install -r requirements-dev.txt && pytest

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm install -g pnpm
      - run: cd apps/admin-web && pnpm test

  docker:
    needs: [test-java, test-python, test-frontend]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build
      - run: docker compose up -d && sleep 30 && docker compose ps
```

---

> **下一部分:** Round 4 其余章节 — 前端页面清单、安全合规、测试策略、路线图、风险与假设（由 3 个子代理并行产出中）
