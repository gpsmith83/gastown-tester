import * as crypto from 'crypto';

/**
 * Centralized secret management and redaction service
 * Handles encryption/decryption of stored credentials and log redaction
 */
export class SecretManager {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly SALT_LENGTH = 32;
  private static readonly TAG_LENGTH = 16;

  // Patterns to detect and redact sensitive information in logs
  private static readonly REDACTION_PATTERNS = [
    // API Keys and tokens (various formats)
    /\b[A-Za-z0-9]{20,}\b/g, // Generic tokens 20+ chars
    /\bsk-[A-Za-z0-9]{32,}\b/g, // OpenAI API keys
    /\blin_api_[A-Za-z0-9]{32,}\b/g, // Linear API tokens
    /\bgho_[A-Za-z0-9]{32,}\b/g, // GitHub OAuth tokens
    /\bghp_[A-Za-z0-9]{32,}\b/g, // GitHub personal access tokens
    /\bBearer\s+[A-Za-z0-9+/=]{20,}\b/gi, // Bearer tokens
    /\bAuthorization:\s*[A-Za-z0-9+/=]{20,}\b/gi, // Authorization headers
    // Password-like patterns
    /\b(password|pwd|pass|secret|token|key|api_key|apikey|auth)["\s:=]+[^\s"]{8,}/gi,
    // JWT tokens
    /\bey[A-Za-z0-9+/=]{20,}\.[A-Za-z0-9+/=]{20,}\.[A-Za-z0-9+/=]{20,}/g,
    // Common secrets in URLs
    /(token|key|secret|password)=([^&\s]{8,})/gi,
  ];

  /**
   * Get encryption key from environment
   * In production, this should be loaded from a secure key management service
   */
  private static getEncryptionKey(): Buffer {
    const key = process.env.SECRET_ENCRYPTION_KEY;
    if (!key) {
      throw new Error(
        'SECRET_ENCRYPTION_KEY environment variable is required for secret encryption. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }
    return Buffer.from(key, 'hex');
  }

  /**
   * Encrypt a secret for secure storage
   */
  static encrypt(secret: string): string {
    if (!secret) return '';

    try {
      const key = this.getEncryptionKey();
      const salt = crypto.randomBytes(this.SALT_LENGTH);
      const iv = crypto.randomBytes(this.IV_LENGTH);

      // Derive key using PBKDF2 with salt
      const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');

      const cipher = crypto.createCipher(this.ALGORITHM, derivedKey);
      cipher.setAAD(iv);

      let encrypted = cipher.update(secret, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const tag = cipher.getAuthTag();

      // Combine salt + iv + tag + encrypted data
      const combined = Buffer.concat([
        salt,
        iv,
        tag,
        Buffer.from(encrypted, 'hex')
      ]);

      return combined.toString('base64');
    } catch (error) {
      console.error('[SECRET_MANAGER] Encryption failed:', this.redactSensitiveData(error));
      throw new Error('Failed to encrypt secret');
    }
  }

  /**
   * Decrypt a secret for use
   */
  static decrypt(encryptedSecret: string): string {
    if (!encryptedSecret) return '';

    try {
      const key = this.getEncryptionKey();
      const combined = Buffer.from(encryptedSecret, 'base64');

      // Extract components
      const salt = combined.subarray(0, this.SALT_LENGTH);
      const iv = combined.subarray(this.SALT_LENGTH, this.SALT_LENGTH + this.IV_LENGTH);
      const tag = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH, this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);
      const encrypted = combined.subarray(this.SALT_LENGTH + this.IV_LENGTH + this.TAG_LENGTH);

      // Derive key using same parameters
      const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, 32, 'sha512');

      const decipher = crypto.createDecipher(this.ALGORITHM, derivedKey);
      decipher.setAAD(iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[SECRET_MANAGER] Decryption failed:', this.redactSensitiveData(error));
      throw new Error('Failed to decrypt secret');
    }
  }

  /**
   * Hash a secret for comparison (one-way)
   */
  static hash(secret: string, salt?: string): string {
    const actualSalt = salt || crypto.randomBytes(32).toString('hex');
    const hash = crypto.pbkdf2Sync(secret, actualSalt, 100000, 64, 'sha512').toString('hex');
    return `${actualSalt}:${hash}`;
  }

  /**
   * Verify a secret against a stored hash
   */
  static verifyHash(secret: string, storedHash: string): boolean {
    try {
      const [salt, hash] = storedHash.split(':');
      const computedHash = this.hash(secret, salt);
      return crypto.timingSafeEqual(
        Buffer.from(storedHash),
        Buffer.from(computedHash)
      );
    } catch (error) {
      console.error('[SECRET_MANAGER] Hash verification failed:', this.redactSensitiveData(error));
      return false;
    }
  }

  /**
   * Redact sensitive information from any data structure
   */
  static redactSensitiveData(data: any): any {
    if (typeof data === 'string') {
      return this.redactString(data);
    }

    if (typeof data === 'object' && data !== null) {
      if (Array.isArray(data)) {
        return data.map(item => this.redactSensitiveData(item));
      }

      const redacted: any = {};
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();

        // Completely redact sensitive fields
        if (this.isSensitiveField(lowerKey)) {
          redacted[key] = '[REDACTED]';
        } else if (typeof value === 'string') {
          redacted[key] = this.redactString(value);
        } else {
          redacted[key] = this.redactSensitiveData(value);
        }
      }
      return redacted;
    }

    return data;
  }

  /**
   * Redact sensitive patterns from a string
   */
  private static redactString(str: string): string {
    let redacted = str;

    this.REDACTION_PATTERNS.forEach(pattern => {
      redacted = redacted.replace(pattern, (match) => {
        // Keep first 4 chars for debugging, redact the rest
        if (match.length > 8) {
          return `${match.substring(0, 4)}[REDACTED]`;
        }
        return '[REDACTED]';
      });
    });

    return redacted;
  }

  /**
   * Check if a field name indicates sensitive data
   */
  private static isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'pwd', 'pass', 'secret', 'token', 'key', 'apikey', 'api_key',
      'accesstoken', 'access_token', 'refreshtoken', 'refresh_token',
      'authorization', 'auth', 'jwt', 'bearer', 'credential', 'credentials',
      'private_key', 'privatekey', 'client_secret', 'clientsecret',
      'api_token_hash', 'token_hash', 'encrypted_token', 'encrypted_secret'
    ];

    return sensitiveFields.some(field => fieldName.includes(field));
  }

  /**
   * Get safe logging version of an object (removes all sensitive data)
   */
  static getSafeLoggingObject(obj: any): any {
    return this.redactSensitiveData(obj);
  }

  /**
   * Create a redacted error for logging
   */
  static createSafeError(error: Error, context?: any): any {
    return {
      message: this.redactString(error.message),
      name: error.name,
      stack: this.redactString(error.stack || ''),
      context: context ? this.redactSensitiveData(context) : undefined,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate that a secret meets minimum security requirements
   */
  static validateSecretStrength(secret: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!secret || secret.length === 0) {
      errors.push('Secret cannot be empty');
    }

    if (secret.length < 8) {
      errors.push('Secret must be at least 8 characters long');
    }

    if (secret.length < 20) {
      errors.push('Secret should be at least 20 characters for optimal security');
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^(password|secret|key|token)$/i,
      /^(123456|qwerty|abc123)$/i,
      /^(.)\1{7,}$/, // Repeated characters
    ];

    if (weakPatterns.some(pattern => pattern.test(secret))) {
      errors.push('Secret appears to use a weak or common pattern');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}