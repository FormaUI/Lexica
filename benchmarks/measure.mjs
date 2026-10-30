/**
 * Measuring a case: the time one operation takes and the memory it allocates
 */

import { performance } from 'node:perf_hooks';
import v8 from 'node:v8';
import vm from 'node:vm';

// A full collection before each sample, so each starts from the same heap and no sample pays for garbage another made.
v8.setFlagsFromString('--expose-gc');

const collectGarbage = vm.runInNewContext('gc');

/** Runs an operation the given number of times, answering the milliseconds it took. */
const time = (operation, count) => {
    const start = performance.now();

    for (let index = 0; index < count; index++) {
        operation();
    }

    return performance.now() - start;
};

/**
 * The bytes an operation allocates, on average over the given number of runs: the growth of the heap between each garbage collection, which V8's GC profiler records before and after each, so what a collection
 * reclaims during the runs is still counted. It is allocation, not the heap the operation retains.
 */
const allocated = (operation, count) => {
    const profiler = new v8.GCProfiler();

    collectGarbage();
    profiler.start();

    const before = v8.getHeapStatistics().used_heap_size;

    time(operation, count);

    const after = v8.getHeapStatistics().used_heap_size;
    const { statistics } = profiler.stop();
    let total = 0;
    let last = before;

    for (const { beforeGC, afterGC } of statistics) {
        total += beforeGC.heapStatistics.usedHeapSize - last;
        last = afterGC.heapStatistics.usedHeapSize;
    }

    return (total + after - last) / count;
};

const median = values => {
    const sorted = [...values].sort((left, right) => left - right);
    const middle = sorted.length >> 1;

    return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * Measures an operation: warms it up, finds a batch that runs for about `sampleTime` milliseconds, and times that batch `samples` times. Answers the median microseconds one operation took, the spread of the samples
 * as a fraction of it, and the bytes one operation allocates.
 */
export const measure = (operation, { warmup = 250, sampleTime = 40, samples = 9 } = {}) => {
    let batch = 1;

    while (time(operation, batch) < sampleTime) {
        batch *= 2;
    }

    const warmed = performance.now() + warmup;

    while (performance.now() < warmed) {
        time(operation, batch);
    }

    const times = Array.from({ length: samples }, () => {
        collectGarbage();

        return (time(operation, batch) * 1000) / batch;
    });
    const microseconds = median(times);

    return {
        microseconds,
        spread: (Math.max(...times) - Math.min(...times)) / microseconds,
        bytes: allocated(operation, batch),
    };
};
