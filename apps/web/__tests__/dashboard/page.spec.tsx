import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardPage from '../../app/(main)/dashboard/page';

// Mock recharts (canvas-based, doesn't work well with jsdom)
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
  PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
  Pie: ({ children }: any) => <div>{children}</div>,
  Cell: () => <div />,
  Legend: () => <div />,
}));

// Mock lucide-react
jest.mock('lucide-react', () => ({
  BarChart3: () => <span>BarChart3</span>,
  Users: () => <span>Users</span>,
  MessageSquareText: () => <span>MessageSquareText</span>,
  AlertTriangle: () => <span>AlertTriangle</span>,
  TrendingUp: () => <span>TrendingUp</span>,
  TrendingDown: () => <span>TrendingDown</span>,
  Calendar: () => <span>Calendar</span>,
  FileText: () => <span>FileText</span>,
  ArrowUpRight: () => <span>ArrowUpRight</span>,
  ArrowDownRight: () => <span>ArrowDownRight</span>,
  CheckCircle2: () => <span>CheckCircle2</span>,
  Clock: () => <span>Clock</span>,
  AlertCircle: () => <span>AlertCircle</span>,
  Activity: () => <span>Activity</span>,
}));

describe('DashboardPage', () => {
  it('renders the page title', () => {
    render(<DashboardPage />);
    expect(screen.getByText('工作台')).toBeInTheDocument();
  });

  it('renders all 4 metric cards with zero values', () => {
    render(<DashboardPage />);

    expect(screen.getByText('活跃项目')).toBeInTheDocument();
    expect(screen.getByText('累计入组')).toBeInTheDocument();
    expect(screen.getByText('待复核Query')).toBeInTheDocument();
    expect(screen.getByText('SAE')).toBeInTheDocument();

    // All values are 0
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBe(4);
  });

  it('shows empty state for enrollment trend', () => {
    render(<DashboardPage />);
    expect(screen.getByText('暂无入组数据')).toBeInTheDocument();
    expect(screen.getByText('创建项目并录入受试者后将在此显示入组趋势')).toBeInTheDocument();
  });

  it('shows empty state for stage distribution', () => {
    render(<DashboardPage />);
    expect(screen.getByText('创建项目后将在此显示阶段分布')).toBeInTheDocument();
  });

  it('shows empty state for milestones', () => {
    render(<DashboardPage />);
    expect(screen.getByText('暂无里程碑')).toBeInTheDocument();
    expect(screen.getByText('为项目配置里程碑后将在此显示进度')).toBeInTheDocument();
  });

  it('shows empty state for notifications', () => {
    render(<DashboardPage />);
    expect(screen.getByText('暂无通知')).toBeInTheDocument();
    expect(screen.getByText('系统通知将在此显示')).toBeInTheDocument();
  });

  it('shows empty state for top projects', () => {
    render(<DashboardPage />);
    expect(screen.getByText('暂无项目')).toBeInTheDocument();
    expect(screen.getByText('点击右上角新建项目开始管理临床研究')).toBeInTheDocument();
  });

  it('shows today date', () => {
    render(<DashboardPage />);
    const today = new Date().toLocaleDateString('zh-CN', { weekday: 'long' });
    expect(screen.getByText(new RegExp(today))).toBeInTheDocument();
  });
});
