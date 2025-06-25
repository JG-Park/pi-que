import { Validator } from '@/utils/common/validator';

describe('Validator', () => {
  test('required validation', () => {
    const result = Validator.validate('', ['required']);
    expect(result.isValid).toBe(false);
    expect(result.message).toBe('필수 항목입니다.');
  });

  test('email validation', () => {
    const validEmail = Validator.validate('test@example.com', ['email']);
    expect(validEmail.isValid).toBe(true);

    const invalidEmail = Validator.validate('invalid-email', ['email']);
    expect(invalidEmail.isValid).toBe(false);
    expect(invalidEmail.message).toBe('올바른 이메일 형식이 아닙니다.');
  });

  test('url validation', () => {
    const validUrl = Validator.validate('https://example.com', ['url']);
    expect(validUrl.isValid).toBe(true);

    const invalidUrl = Validator.validate('not-a-url', ['url']);
    expect(invalidUrl.isValid).toBe(false);
  });

  test('youtube url validation', () => {
    const validYoutube = Validator.validate('https://youtube.com/watch?v=dQw4w9WgXcQ', ['youtube']);
    expect(validYoutube.isValid).toBe(true);

    const invalidYoutube = Validator.validate('https://example.com', ['youtube']);
    expect(invalidYoutube.isValid).toBe(false);
  });

  test('multiple rules', () => {
    const result = Validator.validate('test@example.com', ['required', 'email']);
    expect(result.isValid).toBe(true);
  });
}); 