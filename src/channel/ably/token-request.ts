export class SequentialAuthTokenRequestExecuter {
    cachedToken: string;
    queue: TaskQueue;
    requestTokenFn: Function;

    constructor(token: string = null, requestTokenFn: Function) {
        this.cachedToken = token;
        this.requestTokenFn = requestTokenFn;
        this.queue = new TaskQueue();
    }

    execute = (tokenRequestFn: Function): Promise<{ token: string; info: any }> =>
        new Promise((resolve, reject) => {
            this.queue.run(async () => {
                try {
                    const { token, info } = await tokenRequestFn(this.cachedToken);
                    this.cachedToken = token;
                    resolve({ token, info });
                } catch (err) {
                    reject(err);
                }
            });
        });

    request = (channelName: string): Promise<{ token: string; info: any }> =>
        this.execute((token) => this.requestTokenFn(channelName, token));
}

type Task = Function;
class TaskQueue {
    total: Number;
    todo: Array<Task>;
    running: Array<Task>;
    count: Number;

    constructor(tasks: Array<Task> = [], concurrentCount = 1) {
        this.total = tasks.length;
        this.todo = tasks;
        this.running = [];
        this.count = concurrentCount;
    }

    canRunNext = () => this.running.length < this.count && this.todo.length;

    run = async (task: Task) => {
        if (task) {
            this.todo.push(task);
        }
        while (this.canRunNext()) {
            const currentTask = this.todo.shift();
            this.running.push(currentTask);
            await currentTask();
            this.running.shift();
        }
    };
}
