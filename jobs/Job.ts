export default interface Job {
    run(): Promise<void>;
}
