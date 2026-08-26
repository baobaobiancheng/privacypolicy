"use client";

import dynamic from "next/dynamic";

const stepLoading = () => <section className="workspace-panel panel-enter" aria-busy="true">正在加载当前步骤…</section>;

export const ProcessingActivitiesStep = dynamic(
  () => import("./steps/processing-activities-step").then((module) => module.ProcessingActivitiesStep),
  { loading: stepLoading },
);
export const DevicePermissionsStep = dynamic(
  () => import("./steps/device-permissions-step").then((module) => module.DevicePermissionsStep),
  { loading: stepLoading },
);
export const PartnersStep = dynamic(
  () => import("./steps/partners-step").then((module) => module.PartnersStep),
  { loading: stepLoading },
);
export const StorageSecurityStep = dynamic(
  () => import("./steps/storage-security-step").then((module) => module.StorageSecurityStep),
  { loading: stepLoading },
);
export const RightsStep = dynamic(
  () => import("./steps/rights-step").then((module) => module.RightsStep),
  { loading: stepLoading },
);
export const GenerationStep = dynamic(
  () => import("./steps/generation-step").then((module) => module.GenerationStep),
  { loading: stepLoading },
);
