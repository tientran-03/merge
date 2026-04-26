import type { FieldError, FieldErrors } from "react-hook-form";

export const getFieldError = (
  errors: FieldErrors,
  name: string
): FieldError | undefined => {
  if (!name) return undefined;

  const path = name.split(".");
  let current: any = errors;

  for (const key of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[key];
  }

  if (!current || typeof current !== "object") {
    return undefined;
  }

  return current as FieldError;
};
