class importedClass {
    construct new(name) {
        _name = name
    }
    name { _name }

    printName() {
        System.print("My name is %(name)")
    }
}