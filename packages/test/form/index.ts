import { expect } from "vitest";

import { act, fireEvent, waitFor } from "@testing-library/react";

/**
 * writeField writes value into a text field and resolves once the field settles on expectValue.
 * Pass expectValue when the field transforms its input (a mask, for example); it defaults to the
 * written value.
 */
export const writeField = async (field: HTMLElement, value: string, expectValue: string = value) => {
  act(() => {
    fireEvent.blur(field);
    fireEvent.change(field, { target: { value: value } });
    fireEvent.blur(field);
  });

  await waitFor(() => {
    expect((field as HTMLInputElement).value).toBe(expectValue);
  });
};
