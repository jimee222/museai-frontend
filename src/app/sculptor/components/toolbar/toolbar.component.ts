import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BooleanMode, ModifierAction, SculptBrush } from '../../models/sculpt-tools';

type PrimitiveType = 'box' | 'sphere' | 'cylinder';
type ExportFormat = 'glb' | 'stl';

// Side toolbar with primitive creation, toggles, and import/export actions.
@Component({
  selector: 'app-sculptor-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="toolbar" aria-label="Sculptor toolbar">
      <header>Primitives</header>
      <div class="button-group">
        <button type="button" (click)="onPrimitive('box')" title="Add Box (B)" aria-label="Add box">Box</button>
        <button type="button" (click)="onPrimitive('sphere')" title="Add Sphere" aria-label="Add sphere">Sphere</button>
        <button type="button" (click)="onPrimitive('cylinder')" title="Add Cylinder" aria-label="Add cylinder">Cylinder</button>
      </div>

      <header>Brushes</header>
      <div class="button-group">
        <button type="button" (click)="selectBrush('none')" [class.active]="activeBrush === 'none'" aria-label="Default cursor">Cursor</button>
        <button type="button" (click)="selectBrush('grab')" [class.active]="activeBrush === 'grab'" aria-label="Grab brush">Grab</button>
        <button type="button" (click)="selectBrush('inflate')" [class.active]="activeBrush === 'inflate'" aria-label="Inflate brush">Inflate</button>
        <button type="button" (click)="selectBrush('smooth')" [class.active]="activeBrush === 'smooth'" aria-label="Smooth brush">Smooth</button>
      </div>

      <header>Scene</header>
      <div class="button-group toggles">
        <label>
          <input type="checkbox" [checked]="gridEnabled" (change)="toggleGrid.emit($event.target.checked)" />
          Grid
        </label>
        <label>
          <input type="checkbox" [checked]="axesEnabled" (change)="toggleAxes.emit($event.target.checked)" />
          Axes
        </label>
        <label>
          <input type="checkbox" [checked]="lightsEnabled" (change)="toggleLights.emit($event.target.checked)" />
          Lights
        </label>
      </div>

      <header>Actions</header>
      <div class="button-group">
        <button type="button" (click)="triggerImport()" aria-label="Import model">Import</button>
        <button type="button" (click)="resetCamera.emit()" aria-label="Reset camera">Frame Scene</button>
        <button type="button" (click)="saveScene.emit()" aria-label="Save sculpture">Save</button>
      </div>

      <header>Export</header>
      <div class="button-group">
        <button type="button" (click)="onExport('glb')" aria-label="Export GLB">GLB</button>
        <button type="button" (click)="onExport('stl')" aria-label="Export STL">STL</button>
      </div>

      <header>Boolean</header>
      <div class="button-group">
        <button type="button" (click)="onBoolean('union')" [class.active]="booleanMode === 'union'" aria-label="Union boolean">Union</button>
        <button type="button" (click)="onBoolean('subtract')" [class.active]="booleanMode === 'subtract'" aria-label="Subtract boolean">Subtract</button>
      </div>

      <header>Modifiers</header>
      <div class="button-group">
        <button type="button" (click)="modifierAction.emit('subdivide')" aria-label="Subdivision modifier">Subdivide</button>
        <button type="button" (click)="modifierAction.emit('bevel')" aria-label="Bevel modifier">Bevel</button>
      </div>

      <input
        #importInput
        type="file"
        class="hidden-input"
        multiple
        accept=".glb,.gltf,.obj,.stl,model/gltf-binary,model/gltf+json,application/octet-stream"
        (change)="handleImport($event)"
      />
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        width: 240px;
        background: #0d1117;
        color: #f0f0f0;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        padding: 1rem;
      }
      .toolbar {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }
      header {
        font-weight: 600;
        font-size: 0.9rem;
        letter-spacing: 0.02em;
        text-transform: uppercase;
      }
      .button-group {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      button {
        flex: 1 1 30%;
        padding: 0.35rem 0.5rem;
        border-radius: 4px;
        border: 1px solid rgba(255, 255, 255, 0.12);
        background: rgba(255, 255, 255, 0.04);
        color: inherit;
        cursor: pointer;
        transition: background 0.2s ease;
      }
      button.active {
        background: rgba(59, 130, 246, 0.25);
        border-color: rgba(59, 130, 246, 0.5);
      }
      button:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      .toggles {
        flex-direction: column;
        gap: 0.35rem;
        font-size: 0.85rem;
      }
      label {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }
      .hidden-input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
    `,
  ],
})
export class ToolbarComponent {
  @Input() gridEnabled = true;
  @Input() axesEnabled = true;
  @Input() lightsEnabled = true;
  @Input() activeBrush: SculptBrush = 'none';
  @Input() booleanMode: BooleanMode = 'none';
  @Output() primitive = new EventEmitter<PrimitiveType>();
  @Output() toggleGrid = new EventEmitter<boolean>();
  @Output() toggleAxes = new EventEmitter<boolean>();
  @Output() toggleLights = new EventEmitter<boolean>();
  @Output() resetCamera = new EventEmitter<void>();
  @Output() saveScene = new EventEmitter<void>();
  @Output() exportFormat = new EventEmitter<ExportFormat>();
  @Output() importSelected = new EventEmitter<FileList>();
  @Output() brushSelected = new EventEmitter<SculptBrush>();
  @Output() booleanAction = new EventEmitter<BooleanMode>();
  @Output() modifierAction = new EventEmitter<ModifierAction>();
  @ViewChild('importInput') private importInput?: ElementRef<HTMLInputElement>;

  onPrimitive(type: PrimitiveType): void {
    this.primitive.emit(type);
  }

  onExport(format: ExportFormat): void {
    this.exportFormat.emit(format);
  }

  triggerImport(): void {
    this.importInput?.nativeElement.click();
  }

  handleImport(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      this.importSelected.emit(files);
    }
    if (this.importInput?.nativeElement) {
      this.importInput.nativeElement.value = '';
    }
  }

  selectBrush(brush: SculptBrush): void {
    this.brushSelected.emit(brush);
  }

  onBoolean(mode: BooleanMode): void {
    if (this.booleanMode === mode) {
      this.booleanAction.emit('none');
    } else {
      this.booleanAction.emit(mode);
    }
  }
}
