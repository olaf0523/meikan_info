import type { CSSProperties } from "react";

/** CSS カスタムプロパティ (--foo) を含む style */
export type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;
