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

export default safeAssert;