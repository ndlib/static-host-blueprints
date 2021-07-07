// This can't be in index.ts with IProjectDefaults because circular references will cause it to fail to compile
export enum OverrideStages {
  TEST,
  PROD,
  ALL,
}
