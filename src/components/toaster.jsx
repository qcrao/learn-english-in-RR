import { Intent, Position, Toaster } from "@blueprintjs/core";

export const AppToaster = Toaster.create({
  className: "color-toaster",
  position: Position.TOP,
  intent: Intent.WARNING,
  icon: "warning-sign",
  maxToasts: 1,
  timeout: 12000,
});
