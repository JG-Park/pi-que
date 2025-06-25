'use client';

import { useForm, UseFormProps, UseFormReturn, FieldValues, DefaultValues, FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCallback, useState } from 'react';

export interface UseFormStateOptions<TFieldValues extends FieldValues = FieldValues> extends UseFormProps<TFieldValues> {
  /**
   * Zod schema for validation
   */
  schema?: z.ZodSchema<TFieldValues>;
  /**
   * Called when form is successfully submitted
   */
  onSubmit?: (data: TFieldValues) => void | Promise<void>;
  /**
   * Called when form submission fails validation
   */
  onError?: (errors: any) => void;
  /**
   * Whether to reset form after successful submission
   */
  resetOnSubmit?: boolean;
  /**
   * Whether to show success message after submission
   */
  showSuccessMessage?: boolean;
  /**
   * Custom success message
   */
  successMessage?: string;
  /**
   * Whether to automatically save form data to localStorage
   */
  autoSave?: boolean;
  /**
   * Key for localStorage auto-save
   */
  autoSaveKey?: string;
}

export interface UseFormStateReturn<TFieldValues extends FieldValues = FieldValues> extends Omit<UseFormReturn<TFieldValues>, 'handleSubmit'> {
  /**
   * Enhanced submit handler with loading and error states
   */
  handleSubmit: (e?: React.BaseSyntheticEvent) => Promise<void>;
  /**
   * Whether form is currently submitting
   */
  isSubmitting: boolean;
  /**
   * Whether form was successfully submitted
   */
  isSubmitted: boolean;
  /**
   * Submission error message
   */
  submitError: string | null;
  /**
   * Success message after submission
   */
  successMessage: string | null;
  /**
   * Clear all form states (reset + clear errors/messages)
   */
  clearForm: () => void;
  /**
   * Set field value with automatic validation
   */
  setFieldValue: <TFieldName extends FieldPath<TFieldValues>>(
    name: TFieldName,
    value: TFieldValues[TFieldName]
  ) => void;
  /**
   * Get field error message
   */
  getFieldError: (name: FieldPath<TFieldValues>) => string | undefined;
  /**
   * Check if field has error
   */
  hasFieldError: (name: FieldPath<TFieldValues>) => boolean;
  /**
   * Form validation state
   */
  isValid: boolean;
  /**
   * Whether form has been touched
   */
  isDirty: boolean;
  /**
   * Auto-save methods
   */
  autoSave: {
    save: () => void;
    load: () => void;
    clear: () => void;
    exists: boolean;
  };
}

/**
 * Enhanced form state management hook with react-hook-form and zod validation
 * 
 * @example
 * ```tsx
 * const schema = z.object({
 *   email: z.string().email('Invalid email'),
 *   password: z.string().min(6, 'Password must be at least 6 characters')
 * });
 * 
 * const form = useFormState({
 *   schema,
 *   defaultValues: { email: '', password: '' },
 *   onSubmit: async (data) => {
 *     await login(data);
 *   },
 *   resetOnSubmit: true,
 *   autoSave: true,
 *   autoSaveKey: 'login-form'
 * });
 * 
 * return (
 *   <form onSubmit={form.handleSubmit}>
 *     <input {...form.register('email')} />
 *     {form.getFieldError('email') && <span>{form.getFieldError('email')}</span>}
 *     
 *     <input {...form.register('password')} type="password" />
 *     {form.getFieldError('password') && <span>{form.getFieldError('password')}</span>}
 *     
 *     <button type="submit" disabled={form.isSubmitting}>
 *       {form.isSubmitting ? 'Submitting...' : 'Submit'}
 *     </button>
 *     
 *     {form.submitError && <div className="error">{form.submitError}</div>}
 *     {form.successMessage && <div className="success">{form.successMessage}</div>}
 *   </form>
 * );
 * ```
 */
export function useFormState<TFieldValues extends FieldValues = FieldValues>(
  options: UseFormStateOptions<TFieldValues> = {}
): UseFormStateReturn<TFieldValues> {
  const {
    schema,
    onSubmit,
    onError,
    resetOnSubmit = false,
    showSuccessMessage = false,
    successMessage: customSuccessMessage = 'Form submitted successfully!',
    autoSave = false,
    autoSaveKey = 'form-data',
    ...formOptions
  } = options;

  // Setup form with zod resolver if schema provided
  const formConfig: UseFormProps<TFieldValues> = {
    ...formOptions,
    ...(schema && { resolver: zodResolver(schema) }),
  };

  // Initialize form
  const form = useForm<TFieldValues>(formConfig);

  // Additional state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Auto-save functions
  const saveToStorage = useCallback(() => {
    if (!autoSave || typeof window === 'undefined') return;
    
    try {
      const formData = form.getValues();
      localStorage.setItem(`useFormState-${autoSaveKey}`, JSON.stringify(formData));
    } catch (error) {
      console.warn('Failed to save form data to localStorage:', error);
    }
  }, [autoSave, autoSaveKey, form]);

  const loadFromStorage = useCallback(() => {
    if (!autoSave || typeof window === 'undefined') return;
    
    try {
      const savedData = localStorage.getItem(`useFormState-${autoSaveKey}`);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        Object.entries(parsedData).forEach(([key, value]) => {
          form.setValue(key as FieldPath<TFieldValues>, value as any);
        });
      }
    } catch (error) {
      console.warn('Failed to load form data from localStorage:', error);
    }
  }, [autoSave, autoSaveKey, form]);

  const clearStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(`useFormState-${autoSaveKey}`);
    } catch (error) {
      console.warn('Failed to clear form data from localStorage:', error);
    }
  }, [autoSaveKey]);

  const storageExists = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      return localStorage.getItem(`useFormState-${autoSaveKey}`) !== null;
    } catch {
      return false;
    }
  }, [autoSaveKey]);

  // Enhanced submit handler
  const handleSubmit = useCallback(async (e?: React.BaseSyntheticEvent) => {
    e?.preventDefault();
    
    setIsSubmitting(true);
    setSubmitError(null);
    setSuccessMessage(null);

    try {
      await form.handleSubmit(
        async (data) => {
          if (onSubmit) {
            await onSubmit(data);
          }
          
          setIsSubmitted(true);
          
          if (showSuccessMessage) {
            setSuccessMessage(customSuccessMessage);
          }
          
          if (resetOnSubmit) {
            form.reset();
            if (autoSave) {
              clearStorage();
            }
          } else if (autoSave) {
            saveToStorage();
          }
        },
        (errors) => {
          setSubmitError('Please fix the validation errors and try again.');
          onError?.(errors);
        }
      )(e);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [form, onSubmit, onError, resetOnSubmit, showSuccessMessage, customSuccessMessage, autoSave, saveToStorage, clearStorage]);

  // Enhanced field value setter
  const setFieldValue = useCallback(<TFieldName extends FieldPath<TFieldValues>>(
    name: TFieldName,
    value: TFieldValues[TFieldName]
  ) => {
    form.setValue(name, value, { shouldValidate: true, shouldDirty: true });
    if (autoSave) {
      saveToStorage();
    }
  }, [form, autoSave, saveToStorage]);

  // Field error helpers
  const getFieldError = useCallback((name: FieldPath<TFieldValues>) => {
    return form.formState.errors[name]?.message as string | undefined;
  }, [form.formState.errors]);

  const hasFieldError = useCallback((name: FieldPath<TFieldValues>) => {
    return !!form.formState.errors[name];
  }, [form.formState.errors]);

  // Clear form
  const clearForm = useCallback(() => {
    form.reset();
    setIsSubmitted(false);
    setSubmitError(null);
    setSuccessMessage(null);
    if (autoSave) {
      clearStorage();
    }
  }, [form, autoSave, clearStorage]);

  // Load saved data on mount
  useState(() => {
    if (autoSave) {
      loadFromStorage();
    }
  });

  return {
    ...form,
    handleSubmit,
    isSubmitting,
    isSubmitted,
    submitError,
    successMessage,
    clearForm,
    setFieldValue,
    getFieldError,
    hasFieldError,
    isValid: form.formState.isValid,
    isDirty: form.formState.isDirty,
    autoSave: {
      save: saveToStorage,
      load: loadFromStorage,
      clear: clearStorage,
      exists: storageExists(),
    },
  };
}

/**
 * Simple hook for managing multi-step forms
 * 
 * @example
 * ```tsx
 * const multiStep = useMultiStepForm({
 *   steps: ['personal', 'contact', 'preferences'],
 *   onComplete: (allData) => console.log(allData)
 * });
 * 
 * const currentForm = useFormState({
 *   onSubmit: (data) => {
 *     multiStep.setStepData(multiStep.currentStep, data);
 *     if (multiStep.isLastStep) {
 *       multiStep.complete();
 *     } else {
 *       multiStep.nextStep();
 *     }
 *   }
 * });
 * 
 * return (
 *   <div>
 *     <div>Step {multiStep.currentStepIndex + 1} of {multiStep.totalSteps}</div>
 *     <button onClick={multiStep.previousStep} disabled={multiStep.isFirstStep}>Previous</button>
 *     <button onClick={currentForm.handleSubmit}>
 *       {multiStep.isLastStep ? 'Submit' : 'Next'}
 *     </button>
 *   </div>
 * );
 * ```
 */
export function useMultiStepForm(options: {
  steps: string[];
  onStepChange?: (step: string, stepIndex: number) => void;
  onComplete?: (allData: Record<string, any>) => void | Promise<void>;
}) {
  const { steps, onStepChange, onComplete } = options;
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepData, setStepDataState] = useState<Record<string, any>>({});

  const currentStep = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;
  const totalSteps = steps.length;

  const nextStep = useCallback(() => {
    if (!isLastStep) {
      const newIndex = currentStepIndex + 1;
      setCurrentStepIndex(newIndex);
      onStepChange?.(steps[newIndex], newIndex);
    }
  }, [isLastStep, currentStepIndex, steps, onStepChange]);

  const previousStep = useCallback(() => {
    if (!isFirstStep) {
      const newIndex = currentStepIndex - 1;
      setCurrentStepIndex(newIndex);
      onStepChange?.(steps[newIndex], newIndex);
    }
  }, [isFirstStep, currentStepIndex, steps, onStepChange]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStepIndex(stepIndex);
      onStepChange?.(steps[stepIndex], stepIndex);
    }
  }, [steps, onStepChange]);

  const setStepData = useCallback((step: string, data: any) => {
    setStepDataState(prev => ({ ...prev, [step]: data }));
  }, []);

  const complete = useCallback(async () => {
    await onComplete?.(stepData);
  }, [onComplete, stepData]);

  return {
    currentStep,
    currentStepIndex,
    isFirstStep,
    isLastStep,
    totalSteps,
    nextStep,
    previousStep,
    goToStep,
    setStepData,
    stepData,
    complete,
  };
} 