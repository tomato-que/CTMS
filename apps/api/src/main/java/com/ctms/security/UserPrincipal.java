package com.ctms.security;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class UserPrincipal {
    private String userId;
    private String username;
    private List<String> roles;
}
