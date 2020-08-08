import { VanessaEditor } from "./vanessa-editor";
import { VanessaEditorEvent } from "./common";

export interface IVanessaAction {
  id: string;
  title: string;
}

interface IVanessaCommand {
  eventId: string;
  keyCode: string;
  keyMod: Array<string>;
  title: string;
  errorLink: string;
  script: string;
}

export class ActionManager {

  public VanessaEditor: VanessaEditor;
  public editor: monaco.editor.IStandaloneCodeEditor;
  public codeActions: Array<IVanessaAction> = [];
  public errorLinks: Array<IVanessaAction> = [];
  public codeLens: Array<IVanessaAction> = [];
  public traceKeyboard: boolean = false;

  constructor(
    VanessaEditor: VanessaEditor
  ) {
    this.VanessaEditor = VanessaEditor;
    this.editor = VanessaEditor.editor;
    this.editor.onKeyDown(e => { if (this.traceKeyboard) this.VanessaEditor.fireEvent(VanessaEditorEvent.ON_KEY_DOWN, e) });
    this.editor.onKeyUp(e => { if (this.traceKeyboard) this.VanessaEditor.fireEvent(VanessaEditorEvent.ON_KEY_UP, e) });
    this.editor.onDidChangeModelContent(() => this.VanessaEditor.fireEvent(VanessaEditorEvent.CONTENT_DID_CHANGE));
    this.editor.onDidChangeCursorPosition(
      (e: monaco.editor.ICursorPositionChangedEvent) => {
        this.VanessaEditor.fireEvent(VanessaEditorEvent.POSITION_DID_CHANGE, { lineNumber: e.position.lineNumber, column: e.position.column })
      }
    );
    let service = this.editor.getContribution('editor.contrib.hover')["_openerService"];
    service._original_open = service.open;
    service.open = (target: any, options: any) => {
      if (typeof (target) == "string" && /^\s*http:\/\/|^\s*https:\/\//.test(target)) {
        this.VanessaEditor.fireEvent(VanessaEditorEvent.ON_HREF_CLICK, target);
        return { catch: () => { } };
      }
      return service._original_open(target, options);
    };
  }

  public dispose(): void {
    this.editor = null;
  }

  get actions(): any {
    return this.editor.getSupportedActions().map(e => { return { id: e.id, alias: e.alias, label: e.label } });
  }

  public insertText(text: string, arg: string = undefined) {
    let position = this.editor.getPosition();
    let range = arg ? JSON.parse(arg) : new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
    let operation = { range: range, text: text, forceMoveMarkers: true };
    this.editor.executeEdits("vanessa-editor", [operation]);
  }

  public addCommands(commands: Array<IVanessaCommand>) {
    commands.forEach((e: IVanessaCommand) => {
      if (e.errorLink) {
        this.errorLinks.push({ id: e.eventId, title: e.errorLink });
      } else {
        let keybinding: number = e.keyCode ? Number(monaco.KeyCode[e.keyCode]) : undefined;
        if (e.keyMod) e.keyMod.forEach((id: string) => keybinding |= Number(monaco.KeyMod[id]));
        let id: string = this.editor.addCommand(keybinding, (c, a) => {
          let n = a ? a : this.VanessaEditor.getPosition().lineNumber;
          this.VanessaEditor.fireEvent(`${e.eventId}`, n);
          eval.apply(null, [`${e.script}`]);
        });
        if (e.title) { this.codeActions.push({ id: id, title: e.title }); }
      }
    });
  }

  public setSuggestWidgetWidth(arg: any) {
    const id = 'vanessa-suggest-widget-style';
    let style = document.getElementById(id) as HTMLElement;
    if (style == null) {
      style = document.createElement('style');
      style.setAttribute("type", "text/css");
      style.id = id;
      document.head.appendChild(style)
    }
    let width = typeof (arg) == "number" ? String(arg) + 'px' : arg;
    style.innerHTML = `.suggest-widget{width:${width} !important}`;
  }
}
