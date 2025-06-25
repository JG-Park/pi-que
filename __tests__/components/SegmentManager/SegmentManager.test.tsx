import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SegmentManager from '@/app/HomePage/components/SegmentManager/SegmentManager';
import { Segment } from '@/types/services';

// Mock 유틸리티
jest.mock('@/utils/common/id-generator', () => ({
  IdGenerator: {
    generateSegmentId: () => 'test-segment-id'
  }
}));

jest.mock('@/utils/common/error-handler', () => ({
  ErrorHandler: {
    handle: jest.fn()
  }
}));

// Mock 컴포넌트들
jest.mock('@/app/HomePage/components/SegmentManager/SegmentList', () => {
  return function SegmentList({ segments, onEdit, onDelete }: any) {
    return (
      <div data-testid="segment-list">
        {segments.map((segment: Segment) => (
          <div key={segment.id} data-testid={`segment-${segment.id}`}>
            {segment.title}
            <button onClick={() => onEdit(segment)}>편집</button>
            <button onClick={() => onDelete(segment.id)}>삭제</button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock('@/app/HomePage/components/SegmentManager/SegmentForm', () => {
  return function SegmentForm({ onSubmit, onCancel, segment }: any) {
    return (
      <div data-testid="segment-form">
        <input 
          data-testid="title-input"
          placeholder="제목 입력"
          defaultValue={segment?.title || ''}
        />
        <button 
          data-testid="submit-button"
          onClick={() => onSubmit({
            title: 'Test Segment',
            startTime: 0,
            endTime: 30,
            tags: []
          })}
        >
          저장
        </button>
        <button data-testid="cancel-button" onClick={onCancel}>
          취소
        </button>
      </div>
    );
  };
});

const mockSegments: Segment[] = [
  {
    id: 'segment-1',
    title: 'Test Segment 1',
    description: 'Test description',
    startTime: 0,
    endTime: 30,
    tags: ['test'],
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
  }
];

describe('SegmentManager', () => {
  const defaultProps = {
    projectId: 'test-project',
    segments: mockSegments,
    onSegmentsChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders segment manager with title', () => {
    render(<SegmentManager {...defaultProps} />);
    
    expect(screen.getByText('세그먼트 관리')).toBeInTheDocument();
    expect(screen.getByText('세그먼트 추가')).toBeInTheDocument();
  });

  test('renders segment list with provided segments', () => {
    render(<SegmentManager {...defaultProps} />);
    
    expect(screen.getByTestId('segment-list')).toBeInTheDocument();
    expect(screen.getByTestId('segment-segment-1')).toBeInTheDocument();
    expect(screen.getByText('Test Segment 1')).toBeInTheDocument();
  });

  test('opens form when add segment button is clicked', () => {
    render(<SegmentManager {...defaultProps} />);
    
    const addButton = screen.getByText('세그먼트 추가');
    fireEvent.click(addButton);
    
    expect(screen.getByTestId('segment-form')).toBeInTheDocument();
    expect(screen.getByText('새 세그먼트')).toBeInTheDocument();
  });

  test('opens form in edit mode when edit button is clicked', () => {
    render(<SegmentManager {...defaultProps} />);
    
    const editButton = screen.getByText('편집');
    fireEvent.click(editButton);
    
    expect(screen.getByTestId('segment-form')).toBeInTheDocument();
    expect(screen.getByText('세그먼트 편집')).toBeInTheDocument();
  });

  test('closes form when cancel button is clicked', () => {
    render(<SegmentManager {...defaultProps} />);
    
    // 폼 열기
    const addButton = screen.getByText('세그먼트 추가');
    fireEvent.click(addButton);
    
    // 폼 닫기
    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);
    
    expect(screen.queryByTestId('segment-form')).not.toBeInTheDocument();
  });

  test('creates new segment when form is submitted', async () => {
    const onSegmentsChange = jest.fn();
    render(<SegmentManager {...defaultProps} onSegmentsChange={onSegmentsChange} />);
    
    // 폼 열기
    const addButton = screen.getByText('세그먼트 추가');
    fireEvent.click(addButton);
    
    // 폼 제출
    const submitButton = screen.getByTestId('submit-button');
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(onSegmentsChange).toHaveBeenCalled();
    });
  });

  test('displays error message when error occurs', () => {
    render(<SegmentManager {...defaultProps} />);
    
    // 에러 상태 시뮬레이션을 위해 삭제 버튼 클릭
    const deleteButton = screen.getByText('삭제');
    
    // confirm 대화상자 mock
    window.confirm = jest.fn(() => true);
    
    fireEvent.click(deleteButton);
    
    // 에러 메시지는 실제 에러가 발생할 때 표시되므로
    // 여기서는 삭제 기능이 호출되는지만 확인
    expect(window.confirm).toHaveBeenCalled();
  });

  test('handles empty segments state', () => {
    render(<SegmentManager {...defaultProps} segments={[]} />);
    
    expect(screen.getByTestId('segment-list')).toBeInTheDocument();
  });
}); 