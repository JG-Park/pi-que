import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppProvider, useApp } from '@/contexts/app-context';

// Test reducer function directly
describe('appReducer', () => {
  test('SET_LOADING action updates loading state', () => {
    const TestComponent = () => {
      const { state, setLoading } = useApp();
      
      React.useEffect(() => {
        setLoading(true);
      }, [setLoading]);
      
      return <div>{state.loading ? 'Loading' : 'Not Loading'}</div>;
    };

    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByText('Loading')).toBeInTheDocument();
  });

  test('SET_ERROR action updates error state', () => {
    const TestComponent = () => {
      const { state, setError } = useApp();
      
      React.useEffect(() => {
        setError('Test error');
      }, [setError]);
      
      return <div>{state.error || 'No error'}</div>;
    };

    render(
      <AppProvider>
        <TestComponent />
      </AppProvider>
    );

    expect(screen.getByText('Test error')).toBeInTheDocument();
  });
}); 