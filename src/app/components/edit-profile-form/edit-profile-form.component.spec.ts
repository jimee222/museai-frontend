import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { EditProfileFormComponent } from './edit-profile-form.component';
import { IUser } from '../../interfaces';

describe('EditProfileFormComponent', () => {
  let component: EditProfileFormComponent;
  let fixture: ComponentFixture<EditProfileFormComponent>;
  let formBuilder: FormBuilder;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, EditProfileFormComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EditProfileFormComponent);
    component = fixture.componentInstance;
    formBuilder = new FormBuilder();

   
    component.form = formBuilder.group({
      firstName: [''],
      lastName1: [''],
      lastName2: [''],
      email: [''],
      birthDate: [''],
      phone: [''],
      artLevel: [''],
      passwords: formBuilder.group({
        password: [''],
        confirm: [''],
      }),
    });

    fixture.detectChanges();
  });

 
  it('should create the component with default values', () => {
    expect(component).toBeTruthy();
    expect(component.showArtLevelSelector).toBeTrue();
    expect(component.levels.length).toBe(3);
    expect(component.levels[0].value).toBe('beginner');
  });

  
  it('should emit callSaveMethod event with user data', () => {
    const mockUser: IUser = {
      id: 1,
      firstName: 'Daniel',
      lastName1: 'Cruz',
      lastName2: 'Test',
      birthDate: '1975-01-01',
      email: 'daniel@test.com',
      password: '12345',
      phone: '88888888',
      artLevel: 'intermediate',
    };

    spyOn(component.callSaveMethod, 'emit');

    component.callSaveMethod.emit(mockUser);

    expect(component.callSaveMethod.emit).toHaveBeenCalledOnceWith(mockUser);
  });
});
