const safeAssert = ((assertions : Function, done : Function) => {
    try {
        assertions();
        done();
    } catch(err) {
        done(err);
    }
});

export default safeAssert;