import { applyApiFieldErrors, getApiErrorMessage } from "@repo/api";

export function makeFieldErrorMapper<TFieldName extends string>(
    setFieldError: (name: TFieldName, message: string) => void,
    setFormError: (message: string) => void,
) {
    return function mapFieldError(
        error: unknown,
        fallback: string,
        fieldMap: Partial<Record<string, TFieldName | TFieldName[]>> = {},
    ) {
        const applied = applyApiFieldErrors(
            error,
            (name, { message }) => setFieldError(name, message),
            fieldMap,
        );
        if (!applied) setFormError(getApiErrorMessage(error, fallback));
    };
}