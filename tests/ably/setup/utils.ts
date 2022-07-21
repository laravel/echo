const safeAssert = ((assertions: Function, done: Function, finalAssertion = false) => {
    try {
        assertions();
        if (finalAssertion) {
            done();
        }
    } catch (err) {
        done(err);
    }
});

export const execute = (fn: Function, times : number) => {
    while(times--) {
        fn();
    }
}

export default safeAssert;