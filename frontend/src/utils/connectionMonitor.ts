/**
 * WebSocket连接监控工具
 * 用于调试和监控连接状态
 */

export interface ConnectionStats {
  connections: number;
  disconnections: number;
  reconnects: number;
  lastActivity: number;
  idleTimeouts: number;
  smartModeSkips: number;
  avgConnectionDuration: number;
}

class ConnectionMonitor {
  private stats: ConnectionStats = {
    connections: 0,
    disconnections: 0,
    reconnects: 0,
    lastActivity: 0,
    idleTimeouts: 0,
    smartModeSkips: 0,
    avgConnectionDuration: 0
  };

  private connectionStartTime: number = 0;
  private totalConnectionTime: number = 0;
  private connectionCount: number = 0;

  // 记录连接事件
  onConnect(): void {
    this.stats.connections++;
    this.connectionStartTime = Date.now();
    this.stats.lastActivity = Date.now();
    console.log('📊 连接统计:', {
      总连接数: this.stats.connections,
      当前时间: new Date().toLocaleTimeString()
    });
  }

  // 记录断开连接事件
  onDisconnect(): void {
    this.stats.disconnections++;
    if (this.connectionStartTime > 0) {
      const duration = Date.now() - this.connectionStartTime;
      this.totalConnectionTime += duration;
      this.connectionCount++;
      this.stats.avgConnectionDuration = this.totalConnectionTime / this.connectionCount;
    }
    console.log('📊 断开连接统计:', {
      总断开数: this.stats.disconnections,
      平均连接时长: `${Math.round(this.stats.avgConnectionDuration / 1000)}秒`,
      当前时间: new Date().toLocaleTimeString()
    });
  }

  // 记录重连事件
  onReconnect(): void {
    this.stats.reconnects++;
    console.log('📊 重连统计:', {
      总重连数: this.stats.reconnects,
      当前时间: new Date().toLocaleTimeString()
    });
  }

  // 记录活动
  onActivity(): void {
    this.stats.lastActivity = Date.now();
  }

  // 记录空闲超时
  onIdleTimeout(): void {
    this.stats.idleTimeouts++;
    console.log('📊 空闲超时统计:', {
      总空闲超时数: this.stats.idleTimeouts,
      当前时间: new Date().toLocaleTimeString()
    });
  }

  // 记录智能模式跳过
  onSmartModeSkip(): void {
    this.stats.smartModeSkips++;
    console.log('📊 智能模式跳过统计:', {
      总跳过次数: this.stats.smartModeSkips,
      当前时间: new Date().toLocaleTimeString()
    });
  }

  // 获取当前统计
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  // 打印详细报告
  printReport(): void {
    const timeSinceLastActivity = Date.now() - this.stats.lastActivity;

    console.group('🔍 WebSocket连接详细报告');
    console.log('📈 连接统计:');
    console.log(`  - 总连接数: ${this.stats.connections}`);
    console.log(`  - 总断开数: ${this.stats.disconnections}`);
    console.log(`  - 总重连数: ${this.stats.reconnects}`);
    console.log(`  - 平均连接时长: ${Math.round(this.stats.avgConnectionDuration / 1000)}秒`);
    console.log(`  - 最后活动时间: ${new Date(this.stats.lastActivity).toLocaleTimeString()}`);
    console.log(`  - 距离最后活动: ${Math.round(timeSinceLastActivity / 1000)}秒前`);

    if (this.stats.idleTimeouts > 0) {
      console.log('💤 空闲管理:');
      console.log(`  - 空闲超时次数: ${this.stats.idleTimeouts}`);
    }

    if (this.stats.smartModeSkips > 0) {
      console.log('🧠 智能模式:');
      console.log(`  - 跳过连接次数: ${this.stats.smartModeSkips}`);
      console.log(`  - 节省的资源: 约${this.stats.smartModeSkips * 3}次心跳请求`);
    }

    // 健康度评估
    const healthScore = this.calculateHealthScore();
    const healthEmoji = healthScore > 80 ? '✅' : healthScore > 60 ? '⚠️' : '❌';
    console.log(`${healthEmoji} 连接健康度: ${healthScore}/100`);

    console.groupEnd();
  }

  // 计算连接健康度
  private calculateHealthScore(): number {
    let score = 100;

    // 重连次数影响
    if (this.stats.connections > 0) {
      const reconnectRate = this.stats.reconnects / this.stats.connections;
      score -= Math.round(reconnectRate * 30);
    }

    // 空闲超时次数影响
    if (this.stats.connections > 0) {
      const idleRate = this.stats.idleTimeouts / this.stats.connections;
      score -= Math.round(idleRate * 10);
    }

    // 智能模式效率
    if (this.stats.connections > 0) {
      const skipRate = this.stats.smartModeSkips / this.stats.connections;
      score += Math.min(Math.round(skipRate * 20), 20); // 最多加20分
    }

    return Math.max(0, Math.min(100, score));
  }

  // 重置统计
  reset(): void {
    this.stats = {
      connections: 0,
      disconnections: 0,
      reconnects: 0,
      lastActivity: 0,
      idleTimeouts: 0,
      smartModeSkips: 0,
      avgConnectionDuration: 0
    };
    this.connectionStartTime = 0;
    this.totalConnectionTime = 0;
    this.connectionCount = 0;
    console.log('📊 连接统计已重置');
  }
}

// 导出单例实例
export const connectionMonitor = new ConnectionMonitor();

// 在开发环境下自动打印报告
if (import.meta.env.DEV) {
  setInterval(() => {
    connectionMonitor.printReport();
  }, 60000); // 每分钟打印一次报告
}