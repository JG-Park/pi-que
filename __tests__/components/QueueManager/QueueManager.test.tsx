import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueueManager from '@/app/HomePage/components/QueueManager/QueueManager';
import { QueueItem, QueueState } from '@/types/services';

// Mock 유틸리티
jest.mock('@/utils/common/id-generator', () => ({
  IdGenerator: {
    generate: () => 'test-queue-id'
  }
}));

jest.mock('@/utils/common/error-handler', () => ({
  ErrorHandler: {
    handle: jest.fn().mockReturnValue({ message: 'Test error message' })
  }
}));

// Mock 컴포넌트들
jest.mock('@/app/HomePage/components/QueueManager/QueueList', () => {
  return function QueueList({ queue, currentItemId, onPlayItem, onRemoveItem, onReorder }: any) {
    return (
      <div data-testid="queue-list">
        {queue.map((item: QueueItem) => (
          <div key={item.id} data-testid={`queue-item-${item.id}`}>
            <span>{item.segment.title}</span>
            <button onClick={() => onPlayItem(item.id)}>Play</button>
            <button onClick={() => onRemoveItem(item.id)}>Remove</button>
            <button onClick={() => onReorder([item.id])}>Reorder</button>
          </div>
        ))}
      </div>
    );
  };
});

// 테스트용 데이터
const mockSegment = {
  id: 'seg-1',
  title: 'Test Segment',
  description: 'Test Description',
  startTime: 10,
  endTime: 30,
  tags: ['test'],
  metadata: {
    createdAt: new Date(),
    updatedAt: new Date(),
    order: 0,
    duration: 20
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

const mockQueueItem: QueueItem = {
  id: 'queue-1',
  segmentId: 'seg-1',
  segment: mockSegment,
  order: 0,
  metadata: {
    addedAt: new Date(),
    playCount: 0
  }
};

const mockQueueState: QueueState = {
  currentItemId: null,
  currentPosition: 0,
  isPlaying: false,
  isLooping: false,
  isShuffled: false,
  repeatMode: 'none'
};

describe('QueueManager', () => {
  const defaultProps = {
    projectId: 'test-project',
    queue: [],
    queueState: mockQueueState,
    onQueueChange: jest.fn(),
    onQueueStateChange: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('렌더링이 정상적으로 됩니다', () => {
    render(<QueueManager {...defaultProps} />);
    
    expect(screen.getByText('재생 큐')).toBeInTheDocument();
    expect(screen.getByText('0개 아이템')).toBeInTheDocument();
  });

  it('큐 아이템이 있을 때 목록을 표시합니다', () => {
    const propsWithItems = {
      ...defaultProps,
      queue: [mockQueueItem]
    };
    
    render(<QueueManager {...propsWithItems} />);
    
    expect(screen.getByText('1개 아이템')).toBeInTheDocument();
    expect(screen.getByTestId('queue-list')).toBeInTheDocument();
    expect(screen.getByText('모두 지우기')).toBeInTheDocument();
  });

  it('재생 컨트롤 버튼들이 표시됩니다', () => {
    render(<QueueManager {...defaultProps} />);
    
    // 재생 컨트롤 버튼들이 존재하는지 확인
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
    
    // 빈 큐일 때는 컨트롤이 비활성화되어야 함
    const playButton = buttons.find(btn => btn.querySelector('[class*="w-4 h-4"]'));
    if (playButton) {
      expect(playButton).toBeDisabled();
    }
  });

  it('현재 재생 중인 아이템을 표시합니다', () => {
    const propsWithCurrentItem = {
      ...defaultProps,
      queue: [mockQueueItem],
      queueState: { ...mockQueueState, currentItemId: 'queue-1' }
    };
    
    render(<QueueManager {...propsWithCurrentItem} />);
    
    expect(screen.getByText('재생 중:')).toBeInTheDocument();
  });

  it('큐 아이템 재생 기능이 작동합니다', async () => {
    const onQueueStateChange = jest.fn();
    const propsWithItems = {
      ...defaultProps,
      queue: [mockQueueItem],
      onQueueStateChange
    };
    
    render(<QueueManager {...propsWithItems} />);
    
    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);
    
    // 상태 변경이 호출되었는지 확인
    await waitFor(() => {
      expect(onQueueStateChange).toHaveBeenCalled();
    });
  });

  it('큐 아이템 제거 기능이 작동합니다', async () => {
    const onQueueChange = jest.fn();
    const propsWithItems = {
      ...defaultProps,
      queue: [mockQueueItem],
      onQueueChange
    };
    
    // window.confirm 모킹
    window.confirm = jest.fn().mockReturnValue(true);
    
    render(<QueueManager {...propsWithItems} />);
    
    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);
    
    await waitFor(() => {
      expect(onQueueChange).toHaveBeenCalled();
    });
  });

  it('큐 전체 지우기 기능이 작동합니다', async () => {
    const onQueueChange = jest.fn();
    const onQueueStateChange = jest.fn();
    const propsWithItems = {
      ...defaultProps,
      queue: [mockQueueItem],
      onQueueChange,
      onQueueStateChange
    };
    
    window.confirm = jest.fn().mockReturnValue(true);
    
    render(<QueueManager {...propsWithItems} />);
    
    const clearButton = screen.getByText('모두 지우기');
    fireEvent.click(clearButton);
    
    await waitFor(() => {
      expect(onQueueChange).toHaveBeenCalledWith([]);
      expect(onQueueStateChange).toHaveBeenCalled();
    });
  });

  it('빈 큐 상태를 표시합니다', () => {
    render(<QueueManager {...defaultProps} />);
    
    expect(screen.getByText('0개 아이템')).toBeInTheDocument();
    expect(screen.queryByText('모두 지우기')).not.toBeInTheDocument();
  });
}); 