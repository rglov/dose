export class Plugin {}
export class ItemView {
  contentEl: HTMLElement = document.createElement('div');
  constructor(public leaf: any) {}
}
export class Modal {
  contentEl: HTMLElement = document.createElement('div');
  constructor(public app: any) {}
  open() {}
  close() {}
}
export class Setting {
  constructor(public containerEl: HTMLElement) {}
  setName(_: string) { return this; }
  setDesc(_: string) { return this; }
  addText(_: any) { return this; }
  addTextArea(_: any) { return this; }
  addDropdown(_: any) { return this; }
  addButton(_: any) { return this; }
}
export class PluginSettingTab {
  containerEl: HTMLElement = document.createElement('div');
  constructor(public app: any, public plugin: any) {}
}
export class Notice {
  constructor(_: string) {}
}
export class TFile {}
export const normalizePath = (path: string) => path;
export const WorkspaceLeaf = class {};
