# Types module scenarios

Module: `dailyexpress-api/types`

Types owns small API-local TypeScript interfaces used to describe service errors,
standard API responses, and HTTP methods.

## Success

- `ServiceError` describes errors that can carry an HTTP status code and machine
  code.
- `ApiResponse<T>` describes the shared response envelope:
  `success`, `message`, optional `data`, and optional validation `errors`.
- `HttpMethod` limits method names to known HTTP verbs.

## Failure

- This module has no runtime behavior and does not directly produce failures.
- Compile-time misuse is caught by TypeScript where these types are imported.

## Error

- This module has no runtime error path.
- Runtime error behavior is implemented by service utilities and middleware, not
  by these type declarations.

