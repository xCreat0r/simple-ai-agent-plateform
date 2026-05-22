// const type parameters — TS 5.0+
function tuple<const T extends readonly unknown[]>(...args: T): T {
  return args;
}

// using 声明 / Disposable — TS 5.2+
class Logger implements Disposable {
  #label: string;

  constructor(label: string) {
    this.#label = label;
    console.log(`[${this.#label}] 初始化`);
  }

  log(message: string) {
    console.log(`[${this.#label}] ${message}`);
  }

  [Symbol.dispose]() {
    console.log(`[${this.#label}] 清理`);
  }
}

// 主逻辑
function main() {
  // const type parameter 推导出字面量元组类型
  const point = tuple(3, 7, 2);
  //   ^? readonly [3, 7, 2]

  // using 自动在作用域结束时调用 dispose
  using logger = new Logger('app');
  logger.log(`point = ${point}`);
  logger.log('Happy developing ✨');
}

main();
