golhaprogram.com: layouts/_default/home.html
golhaprogram.com/programs: layouts/programs/list.html
golhaprogram.com/programs/golhaye-rangarang: layouts/programs/section.html
golhaprogram.com/programs/golhaye-rangarang/203: layouts/programs/single.html


layouts/
  programs/
    list.html     # Used for /programs/ - lists all program types
                  # (golhaye rangarang, golhaye tazeh, etc)
    
    section.html  # Used for /programs/golhaye-rangarang/ - lists all 
                  # programs within a specific type
    
    single.html   # Used for individual programs like 
                  # /programs/golhaye-rangarang/203

content/
  programs/
    _index.md     # Main programs page content (uses list.html)
    
    golhaye-rangarang/
      _index.md   # Section content (uses section.html)
      203.md      # Individual program (uses single.html)
      100.md      # Individual program (uses single.html)
