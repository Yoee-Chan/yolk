package com.yolk.auth;

import com.yolk.common.BusinessException;

import java.util.regex.Pattern;

public final class AccountUtils {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern PHONE = Pattern.compile("^1[3-9]\\d{9}$");

    private AccountUtils() {}

    public static boolean isEmail(String account) {
        return account != null && EMAIL.matcher(account.trim()).matches();
    }

    public static boolean isPhone(String account) {
        return account != null && PHONE.matcher(account.trim()).matches();
    }

    public static String normalizeAccount(String account) {
        return account == null ? "" : account.trim();
    }

    public static void requireEmailOrPhone(String email, String phone) {
        boolean hasEmail = email != null && !email.isBlank();
        boolean hasPhone = phone != null && !phone.isBlank();
        if (hasEmail == hasPhone) {
            throw new BusinessException(400, "请提供邮箱或手机号其一");
        }
        if (hasEmail && !isEmail(email)) {
            throw new BusinessException(400, "邮箱格式不正确");
        }
        if (hasPhone && !isPhone(phone)) {
            throw new BusinessException(400, "手机号格式不正确");
        }
    }

    public static String loginKey(String account) {
        String normalized = normalizeAccount(account);
        if (isEmail(normalized) || isPhone(normalized)) {
            return normalized;
        }
        throw new BusinessException(400, "请输入有效邮箱或手机号");
    }
}
