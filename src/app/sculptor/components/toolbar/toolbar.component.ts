import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BooleanMode, ModifierAction, SculptBrush } from '../../models/sculpt-tools';
import { MaterialPreset, SculptSymmetry } from '../../models/sculpture';

type PrimitiveType = 'box' | 'sphere' | 'cylinder';
type ExportFormat = 'glb' | 'stl';

@Component({
  selector: 'app-sculptor-toolbar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="toolbar" aria-label="Barra de herramientas de esculpido">
      <header>Primitivas</header>
      <div class="button-group">
        <button type="button" (click)="onPrimitive('box')" title="Añadir cubo (B)" aria-label="Añadir cubo">Cubo</button>
        <button type="button" (click)="onPrimitive('sphere')" title="Añadir esfera" aria-label="Añadir esfera">Esfera</button>
        <button type="button" (click)="onPrimitive('cylinder')" title="Añadir cilindro" aria-label="Añadir cilindro">Cilindro</button>
      </div>

      <header>Pinceles</header>
      <div class="button-group">
        <button type="button" (click)="selectBrush('none')" [class.active]="activeBrush === 'none'" aria-label="Cursor por defecto">Cursor</button>
        <button type="button" (click)="selectBrush('grab')" [class.active]="activeBrush === 'grab'" aria-label="Pincel mover">Mover</button>
        <button type="button" (click)="selectBrush('inflate')" [class.active]="activeBrush === 'inflate'" aria-label="Pincel inflar">Inflar</button>
        <button type="button" (click)="selectBrush('smooth')" [class.active]="activeBrush === 'smooth'" aria-label="Pincel suavizar">Suavizar</button>
      </div>

      <header>Configuración de pincel</header>
      <div class="selection-controls">
        <label>
          Radio
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            [value]="brushRadius"
            (input)="onBrushRadiusInput($any($event.target).value)"
          />
        </label>
        <label>
          Fuerza
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            [value]="brushStrength"
            (input)="onBrushStrengthInput($any($event.target).value)"
          />
        </label>
      </div>

      <header>Escena</header>
      <div class="button-group toggles">
        <label>
          <input type="checkbox" [checked]="gridEnabled" (change)="toggleGrid.emit($event.target.checked)" />
          Cuadrícula
        </label>
        <label>
          <input type="checkbox" [checked]="axesEnabled" (change)="toggleAxes.emit($event.target.checked)" />
          Ejes
        </label>
        <label>
          <input type="checkbox" [checked]="lightsEnabled" (change)="toggleLights.emit($event.target.checked)" />
          Luces
        </label>
        <label>
          <input
            type="checkbox"
            [checked]="snapToGround"
            (change)="snapToGroundChange.emit($event.target.checked)"
          />
          A tierra
        </label>
      </div>

      <header>Simetría</header>
      <div class="button-group">
        <button type="button" (click)="selectSymmetry('none')" [class.active]="symmetry === 'none'">Ninguna</button>
        <button type="button" (click)="selectSymmetry('x')" [class.active]="symmetry === 'x'">X</button>
        <button type="button" (click)="selectSymmetry('y')" [class.active]="symmetry === 'y'">Y</button>
        <button type="button" (click)="selectSymmetry('z')" [class.active]="symmetry === 'z'">Z</button>
        <button type="button" (click)="selectSymmetry('xy')" [class.active]="symmetry === 'xy'">XY</button>
        <button type="button" (click)="selectSymmetry('xz')" [class.active]="symmetry === 'xz'">XZ</button>
        <button type="button" (click)="selectSymmetry('yz')" [class.active]="symmetry === 'yz'">YZ</button>
      </div>

      <header>Material</header>
      <div class="button-group">
        <button type="button" (click)="selectMaterial('clay')" [class.active]="materialPreset === 'clay'">Arcilla</button>
        <button type="button" (click)="selectMaterial('metal')" [class.active]="materialPreset === 'metal'">Metal</button>
        <button type="button" (click)="selectMaterial('glass')" [class.active]="materialPreset === 'glass'">Vidrio</button>
        <button type="button" (click)="selectMaterial('matte')" [class.active]="materialPreset === 'matte'">Mate</button>
        <button type="button" (click)="selectMaterial('wireframe')" [class.active]="materialPreset === 'wireframe'">Alambre</button>
      </div>

      <header>Selección</header>
      <div class="selection-controls">
        <button type="button" (click)="duplicateSelection.emit()" [disabled]="!selectionAvailable" aria-label="Duplicar selección">
          Duplicar
        </button>
        <label>
          Escala
          <input
            type="range"
            min="0.2"
            max="3"
            step="0.1"
            [value]="selectionScale"
            [disabled]="!selectionAvailable"
            (input)="onScaleInput($any($event.target).value)"
          />
        </label>
        <label>
          Desplazamiento Y
          <input
            type="range"
            min="-5"
            max="5"
            step="0.1"
            [value]="selectionY"
            [disabled]="!selectionAvailable"
            (input)="onYInput($any($event.target).value)"
          />
        </label>
      </div>

      <header>Acciones</header>
      <div class="button-group">
        <button type="button" (click)="triggerImport()" aria-label="Importar modelo">Importar</button>
        <button type="button" (click)="resetCamera.emit()" aria-label="Reiniciar cámara">Centrar escena</button>
        <button type="button" (click)="saveScene.emit()" aria-label="Guardar escultura">Guardar</button>
      </div>

      <header>Exportar</header>
      <div class="button-group">
        <button type="button" (click)="onExport('glb')" aria-label="Exportar GLB">GLB</button>
        <button type="button" (click)="onExport('stl')" aria-label="Exportar STL">STL</button>
      </div>

      <header>Booleanas</header>
      <div class="button-group">
        <button type="button" (click)="onBoolean('union')" [class.active]="booleanMode === 'union'" aria-label="Operación unión">Unión</button>
        <button type="button" (click)="onBoolean('subtract')" [class.active]="booleanMode === 'subtract'" aria-label="Operación restar">Restar</button>
      </div>

      <header>Modificadores</header>
      <div class="button-group">
        <button type="button" (click)="modifierAction.emit('subdivide')" aria-label="Modificador de subdivisión">Subdividir</button>
        <button type="button" (click)="modifierAction.emit('bevel')" aria-label="Modificador de bisel">Bisel</button>
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
        display: flex;
        flex-direction: column;
        width: 240px;
        background: #0d1117;
        color: #f0f0f0;
        border-right: 1px solid rgba(255, 255, 255, 0.08);
        padding: 1rem;
        height: 100%;
        box-sizing: border-box;
        overflow: hidden;
      }
      .toolbar {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        flex: 1 1 auto;
        overflow-y: auto;
        padding-right: 0.5rem;
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
      .selection-controls {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }
      .selection-controls label {
        font-size: 0.8rem;
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
      }
      input[type='range'] {
        width: 100%;
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
  @Input() selectionAvailable = false;
  @Input() selectionScale = 1;
  @Input() selectionY = 0;
  @Input() brushRadius = 0.9;
  @Input() brushStrength = 0.35;
  @Input() symmetry: SculptSymmetry = 'none';
  @Input() materialPreset: MaterialPreset = 'clay';
  @Input() snapToGround = true;
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
  @Output() duplicateSelection = new EventEmitter<void>();
  @Output() selectionScaleChange = new EventEmitter<number>();
  @Output() selectionYChange = new EventEmitter<number>();
  @Output() brushRadiusChange = new EventEmitter<number>();
  @Output() brushStrengthChange = new EventEmitter<number>();
  @Output() symmetryChange = new EventEmitter<SculptSymmetry>();
  @Output() materialPresetChange = new EventEmitter<MaterialPreset>();
  @Output() snapToGroundChange = new EventEmitter<boolean>();
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

  onScaleInput(value: string): void {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      this.selectionScaleChange.emit(parsed);
    }
  }

  onYInput(value: string): void {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      this.selectionYChange.emit(parsed);
    }
  }

  onBrushRadiusInput(value: string): void {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      this.brushRadiusChange.emit(parsed);
    }
  }

  onBrushStrengthInput(value: string): void {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      this.brushStrengthChange.emit(parsed);
    }
  }

  selectSymmetry(value: SculptSymmetry): void {
    this.symmetryChange.emit(value);
  }

  selectMaterial(value: MaterialPreset): void {
    this.materialPresetChange.emit(value);
  }
}
