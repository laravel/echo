import { getSignedToken } from './mock-auth-server';

export class SequentialAuthTokenRequestExecuter {
    cachedToken = null;
    queue: TaskQueue;

    constructor(token : string = null) {
        this.cachedToken = token;
        this.queue = new TaskQueue();
    }

    execute = (tokenRequestFn) => new Promise(async (resolve, reject) => {
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

    request = channelName => this.execute(token => getSignedToken(channelName, token));
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