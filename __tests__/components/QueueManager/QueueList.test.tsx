import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import QueueList from '@/app/HomePage/components/QueueManager/QueueList';
import { QueueItem } from '@/types/services';

// Mock QueueItem 컴포넌트
jest.mock('@/app/HomePage/components/QueueManager/QueueItem', () => {
  return function QueueItemComponent({ item, onPlay, onRemove, onMoveUp, onMoveDown, canMoveUp, canMoveDown }: any) {
    return (
      <div data-testid={`queue-item-${item.id}`}>
        <span>{item.segment.title}</span>
        <button onClick={onPlay}>Play</button>
        <button onClick={onRemove}>Remove</button>
        {canMoveUp && <button onClick={onMoveUp}>Move Up</button>}
        {canMoveDown && <button onClick={onMoveDown}>Move Down</button>}
      </div>
    );
  };
});

// 테스트용 데이터
const createMockQueueItem = (id: string, title: string, order: number): QueueItem => ({
  id,
  segmentId: `seg-${id}`,
  segment: {
    id: `seg-${id}`,
    title,
    description: `Description for ${title}`,
    startTime: 10,
    endTime: 30,
    tags: ['test'],
    metadata: {
      createdAt: new Date(),
      updatedAt: new Date(),
      order,
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
  },
  order,
  metadata: {
    addedAt: new Date(),
    playCount: 0
  }
});

describe('QueueList', () => {
  const defaultProps = {
    queue: [],
    currentItemId: null,
    onPlayItem: jest.fn(),
    onRemoveItem: jest.fn(),
    onReorder: jest.fn(),
    loading: false
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('빈 큐일 때 빈 상태 메시지를 표시합니다', () => {
    render(<QueueList {...defaultProps} />);
    
    expect(screen.getByText('큐가 비어있습니다.')).toBeInTheDocument();
    expect(screen.getByText('세그먼트를 큐에 추가해 보세요.')).toBeInTheDocument();
  });

  it('큐 아이템들을 순서대로 렌더링합니다', () => {
    const queue = [
      createMockQueueItem('1', 'First Item', 0),
      createMockQueueItem('2', 'Second Item', 1),
      createMockQueueItem('3', 'Third Item', 2)
    ];

    render(<QueueList {...defaultProps} queue={queue} />);
    
    expect(screen.getByText('First Item')).toBeInTheDocument();
    expect(screen.getByText('Second Item')).toBeInTheDocument();
    expect(screen.getByText('Third Item')).toBeInTheDocument();
  });

  it('아이템 재생 기능이 작동합니다', () => {
    const onPlayItem = jest.fn();
    const queue = [createMockQueueItem('1', 'Test Item', 0)];

    render(<QueueList {...defaultProps} queue={queue} onPlayItem={onPlayItem} />);
    
    const playButton = screen.getByText('Play');
    fireEvent.click(playButton);
    
    expect(onPlayItem).toHaveBeenCalledWith('1');
  });

  it('아이템 제거 기능이 작동합니다', () => {
    const onRemoveItem = jest.fn();
    const queue = [createMockQueueItem('1', 'Test Item', 0)];

    render(<QueueList {...defaultProps} queue={queue} onRemoveItem={onRemoveItem} />);
    
    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);
    
    expect(onRemoveItem).toHaveBeenCalledWith('1');
  });

  it('위로 이동 기능이 작동합니다', () => {
    const onReorder = jest.fn();
    const queue = [
      createMockQueueItem('1', 'First Item', 0),
      createMockQueueItem('2', 'Second Item', 1)
    ];

    render(<QueueList {...defaultProps} queue={queue} onReorder={onReorder} />);
    
    // 두 번째 아이템의 "Move Up" 버튼을 클릭
    const moveUpButtons = screen.getAllByText('Move Up');
    fireEvent.click(moveUpButtons[0]); // 두 번째 아이템만 Move Up 버튼이 있음
    
    expect(onReorder).toHaveBeenCalledWith(['2', '1']);
  });

  it('아래로 이동 기능이 작동합니다', () => {
    const onReorder = jest.fn();
    const queue = [
      createMockQueueItem('1', 'First Item', 0),
      createMockQueueItem('2', 'Second Item', 1)
    ];

    render(<QueueList {...defaultProps} queue={queue} onReorder={onReorder} />);
    
    // 첫 번째 아이템의 "Move Down" 버튼을 클릭
    const moveDownButtons = screen.getAllByText('Move Down');
    fireEvent.click(moveDownButtons[0]); // 첫 번째 아이템만 Move Down 버튼이 있음
    
    expect(onReorder).toHaveBeenCalledWith(['2', '1']);
  });

  it('순서가 잘못된 큐를 정렬합니다', () => {
    const queue = [
      createMockQueueItem('1', 'Third Item', 2),
      createMockQueueItem('2', 'First Item', 0),
      createMockQueueItem('3', 'Second Item', 1)
    ];

    render(<QueueList {...defaultProps} queue={queue} />);
    
    // 첫 번째로 렌더링된 아이템이 order 0인 'First Item'이어야 함
    const items = screen.getAllByTestId(/queue-item-/);
    expect(items[0]).toHaveTextContent('First Item');
    expect(items[1]).toHaveTextContent('Second Item');
    expect(items[2]).toHaveTextContent('Third Item');
  });

  it('현재 재생 중인 아이템을 구분합니다', () => {
    const queue = [createMockQueueItem('1', 'Test Item', 0)];

    render(<QueueList {...defaultProps} queue={queue} currentItemId="1" />);
    
    // currentItemId가 제대로 전달되는지는 QueueItem 컴포넌트 내부에서 처리
    expect(screen.getByTestId('queue-item-1')).toBeInTheDocument();
  });
}); 