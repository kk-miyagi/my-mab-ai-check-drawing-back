
class A:

    def start(self, args):
        try:
            self.do(args)
            sys.exit(0)
        except Exception as e:
            loggger.log("XXXX")
            sys.exit(1)

    def do(self, args):
