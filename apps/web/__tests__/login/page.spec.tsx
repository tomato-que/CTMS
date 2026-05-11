import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from '../../app/login/page';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

// Mock zustand store
jest.mock('../../lib/store', () => ({
  useAppStore: () => ({
    setUser: jest.fn(),
    setToken: jest.fn(),
  }),
}));

// Mock axios
jest.mock('../../lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  },
}));

import api from '../../lib/api';

describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('renders login form with username and password fields', () => {
    render(<LoginPage />);

    expect(screen.getByPlaceholderText('请输入用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
  });

  it('renders CTMS title and subtitle', () => {
    render(<LoginPage />);

    expect(screen.getByText('CTMS')).toBeInTheDocument();
    expect(screen.getByText('临床研究管理系统')).toBeInTheDocument();
  });

  it('shows demo account info', () => {
    render(<LoginPage />);

    expect(screen.getByText('演示账号')).toBeInTheDocument();
    expect(screen.getByText(/admin \/ admin123/)).toBeInTheDocument();
  });

  it('calls login API and redirects on success', async () => {
    const mockPush = jest.fn();
    jest.spyOn(require('next/navigation'), 'useRouter').mockReturnValue({ push: mockPush, replace: jest.fn() });

    const mockPost = api.post as jest.Mock;
    mockPost.mockResolvedValue({
      code: 0,
      data: {
        accessToken: 'test-token',
        user: { id: '1', username: 'admin', realName: 'Admin', role: { code: 'Admin' } },
      },
    });

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/auth/login', { username: 'admin', password: 'admin123' });
      expect(localStorage.getItem('token')).toBe('test-token');
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('shows error message on failed login', async () => {
    const mockPost = api.post as jest.Mock;
    mockPost.mockRejectedValue({ message: '用户名或密码错误' });

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'wrong');
    await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(screen.getByText('用户名或密码错误')).toBeInTheDocument();
    });
  });

  it('shows disabled button while loading', async () => {
    const mockPost = api.post as jest.Mock;
    mockPost.mockImplementation(() => new Promise(() => {})); // never resolves

    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText('请输入用户名'), 'admin');
    await userEvent.type(screen.getByPlaceholderText('请输入密码'), 'admin123');
    await userEvent.click(screen.getByRole('button', { name: '登录' }));

    expect(screen.getByRole('button', { name: '登录中...' })).toBeDisabled();
  });
});
