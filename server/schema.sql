CREATE TABLE IF NOT EXISTS admins (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 email VARCHAR(254) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS content_items (
 id CHAR(36) NOT NULL PRIMARY KEY,
 collection VARCHAR(32) NOT NULL,
 data LONGTEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX content_items_collection_idx (collection)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS site_settings (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 data LONGTEXT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO site_settings(id,data) VALUES(1, '{"heroTitle":"Wholesale, reimagined.","heroSubtitle":"Discover independent brands and products made for your business.","heroImage":"","logoImage":"/logo.png","announcement":"Discover something new at iCoFyz","navigation":[{"label":"Home","url":"/"},{"label":"Shop","url":"/#products"},{"label":"Categories","url":"/#categories"},{"label":"Brands","url":"/#brands"}],"promoBanners":[],"footerText":"A wholesale marketplace connecting independent brands and retailers.","footerLinks":[{"label":"About us","url":"#"},{"label":"Contact","url":"#"},{"label":"Privacy","url":"#"}]}');


CREATE TABLE IF NOT EXISTS customers (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 full_name VARCHAR(160) NOT NULL,
 email VARCHAR(254) NOT NULL UNIQUE,
 business_name VARCHAR(180) NOT NULL,
 business_type ENUM('retailer','brand') NOT NULL DEFAULT 'retailer',
 password_hash VARCHAR(255) NOT NULL,
 status ENUM('active','pending') NOT NULL DEFAULT 'active',
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX customers_business_type_idx (business_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
