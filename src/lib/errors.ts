export type SealedErrorType =
  | "InvalidStateTransitionError"
  | "CertificateIntegrityError"
  | "AuthoritativeInputError"
  | "PersistenceUnavailableError"
  | "CertificateStorageError";

abstract class SealedError extends Error {
  abstract readonly type: SealedErrorType;
  abstract readonly statusCode: number;
  abstract readonly retryable: boolean;
  readonly code: string;
  readonly requestId?: string;

  constructor(message: string, code: string, requestId?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.requestId = requestId;
    if (typeof Error.captureStackTrace === "function") {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class InvalidStateTransitionError extends SealedError {
  readonly type = "InvalidStateTransitionError";
  readonly statusCode = 409;
  readonly retryable = false;
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(message: string, from: string, to: string, requestId?: string) {
    super(message, "INVALID_STATE_TRANSITION", requestId);
    this.fromStatus = from;
    this.toStatus = to;
  }
}

export class CertificateIntegrityError extends SealedError {
  readonly type = "CertificateIntegrityError";
  readonly statusCode = 503;
  readonly retryable = true;
  readonly integrityKind: "sha256_mismatch" | "download_failed" | "size_mismatch" | "missing_artifact";

  constructor(message: string, kind: CertificateIntegrityError["integrityKind"], requestId?: string) {
    super(message, `INTEGRITY_${kind.toUpperCase()}`, requestId);
    this.integrityKind = kind;
  }
}

export class AuthoritativeInputError extends SealedError {
  readonly type = "AuthoritativeInputError";
  readonly statusCode = 400;
  readonly retryable = false;
  readonly field: string;

  constructor(message: string, field: string, requestId?: string) {
    super(message, `AUTHORITATIVE_INPUT_MISSING:${field}`, requestId);
    this.field = field;
  }
}

export const isSealedError = (e: unknown): e is SealedError => {
  return e instanceof SealedError;
};
