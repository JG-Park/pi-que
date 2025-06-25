import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import SegmentForm from '@/app/HomePage/components/SegmentManager/SegmentForm';

// Mock TimeFormatter
jest.mock('@/utils/time/time-formatter', () => ({
  TimeFormatter: {
    timeToSeconds: (time: string) => {
      if (time === '1:30') return 90;
      if (time === '2:00') return 120;
      if (time === 'invalid') throw new Error('Invalid time');
      return 0;
    },
    secondsToTime: (seconds: number) => {
      if (seconds === 90) return '1:30';
      if (seconds === 120) return '2:00';
      return '0:00';
    }
  }
}));

describe('SegmentForm', () => {
  const defaultProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders form fields correctly', () => {
    render(<SegmentForm {...defaultProps} />);
    
    expect(screen.getByLabelText('제목 *')).toBeInTheDocument();
    expect(screen.getByLabelText('설명')).toBeInTheDocument();
    expect(screen.getByLabelText('시작 시간 *')).toBeInTheDocument();
    expect(screen.getByLabelText('종료 시간 *')).toBeInTheDocument();
    expect(screen.getByLabelText('태그')).toBeInTheDocument();
  });

  test('shows validation error for empty title', async () => {
    const user = userEvent.setup();
    render(<SegmentForm {...defaultProps} />);
    
    const submitButton = screen.getByText('추가');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('제목을 입력해주세요.')).toBeInTheDocument();
    });
  });

  test('shows validation error for invalid time format', async () => {
    const user = userEvent.setup();
    render(<SegmentForm {...defaultProps} />);
    
    const titleInput = screen.getByLabelText('제목 *');
    const startTimeInput = screen.getByLabelText('시작 시간 *');
    
    await user.type(titleInput, 'Test Segment');
    await user.type(startTimeInput, 'invalid');
    
    const submitButton = screen.getByText('추가');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText('올바른 시간 형식을 입력해주세요. (예: 1:30, 0:05:30)')).toBeInTheDocument();
    });
  });

  test('submits form with valid data', async () => {
    const user = userEvent.setup();
    const onSubmit = jest.fn();
    
    render(<SegmentForm {...defaultProps} onSubmit={onSubmit} />);
    
    // 폼 입력
    await user.type(screen.getByLabelText('제목 *'), 'Test Segment');
    await user.type(screen.getByLabelText('설명'), 'Test description');
    await user.type(screen.getByLabelText('시작 시간 *'), '1:30');
    await user.type(screen.getByLabelText('종료 시간 *'), '2:00');
    await user.type(screen.getByLabelText('태그'), 'tag1, tag2');
    
    const submitButton = screen.getByText('추가');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        title: 'Test Segment',
        description: 'Test description',
        startTime: 90,
        endTime: 120,
        tags: ['tag1', 'tag2']
      });
    });
  });

  test('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    
    render(<SegmentForm {...defaultProps} onCancel={onCancel} />);
    
    const cancelButton = screen.getByText('취소');
    await user.click(cancelButton);
    
    expect(onCancel).toHaveBeenCalled();
  });

  test('pre-fills form when editing existing segment', () => {
    const segment = {
      id: 'test-id',
      title: 'Existing Segment',
      description: 'Existing description',
      startTime: 90,
      endTime: 120,
      tags: ['existing'],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        order: 0,
        duration: 30
      },
      settings: {
        autoPlay: false,
        loop: false,
        volume: 100,
        playbackRate: 1,
        fadeIn: 0,
        fadeOut: 0
      }
    };
    
    render(<SegmentForm {...defaultProps} segment={segment} />);
    
    expect(screen.getByDisplayValue('Existing Segment')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Existing description')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1:30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2:00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('existing')).toBeInTheDocument();
    expect(screen.getByText('수정')).toBeInTheDocument();
  });

  test('disables form when loading', () => {
    render(<SegmentForm {...defaultProps} loading={true} />);
    
    expect(screen.getByLabelText('제목 *')).toBeDisabled();
    expect(screen.getByLabelText('설명')).toBeDisabled();
    expect(screen.getByLabelText('시작 시간 *')).toBeDisabled();
    expect(screen.getByLabelText('종료 시간 *')).toBeDisabled();
    expect(screen.getByLabelText('태그')).toBeDisabled();
    expect(screen.getByText('추가')).toBeDisabled();
    expect(screen.getByText('취소')).toBeDisabled();
  });
}); 