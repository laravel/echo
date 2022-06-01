export class SequentialAuthTokenRequestExecuter {
    cachedToken: string;
    queue: TaskQueue;
    requestTokenFn: Function;

    constructor(token: string = null, requestTokenFn: Function) {
        this.cachedToken = token;
        this.requestTokenFn = requestTokenFn;
        this.queue = new TaskQueue();
    }

    execute = (tokenRequestFn): Promise<string> => new Promise(async (resolve, reject) => {
        await this.queue.run(async () => {
            try {
                const token = await tokenRequestFn(this.cachedToken);
                this.cachedToken = token;
                resolve(token);
            } catch (err) {
                reject(err);
            }
        })
    })

    request = (channelName):Promise<string> => this.execute(token => this.requestTokenFn(channelName, token));
}

class TaskQueue {
    total: Number;
    todo: Array<Function>;
    running: Array<Function>;
    count: Number;

    constructor(tasks = [], concurrentCount = 1) {
        this.total = tasks.length;
        this.todo = tasks;
        this.running = [];
        this.count = concurrentCount;
    }

    canRunNext = () => (this.running.length < this.count) && this.todo.length;

    run = async (task: Function) => {
        if (task) {
            this.todo.push(task);
        }
        while (this.canRunNext()) {
            const currentTask = this.todo.shift();
            this.running.push(currentTask);
            await currentTask();
            this.running.shift();
        }
    }
}