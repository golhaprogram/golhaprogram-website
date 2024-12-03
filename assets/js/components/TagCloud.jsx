import React, { useState } from 'react';

const TagCloud = ({ data, programType }) => {
  const [selectedCategory, setSelectedCategory] = useState('singers');

  const calculateSize = (count, maxCount) => {
    const minSize = 14;
    const maxSize = 32;
    return minSize + (count / maxCount) * (maxSize - minSize);
  };

  // Helper function to convert name to URL-friendly slug
  const nameToSlug = (name) => {
    //return name.replace(/\s+/g, '-');
    //return name.toLowerCase().replace(/[\s\.\+]+/g, '-');
    // Replace ZWNJ (Nim faseleh) with dash. Also replace all spaces with dashes.
    //return name.toLowerCase().replace(/\u200C/g, '-').replace(/[\s\.\+]+/g,'-');

    // Remove ZWNJ (Nim faseleh). Also replace all spaces with dashes.
    return name.toLowerCase().replace(/\u200C/g, '').replace(/[\s\.\+]+/g,'-');

  };

  // Get max count for current category
  const maxCount = data[selectedCategory] ? 
    Math.max(...Object.values(data[selectedCategory]).map(n => n)) : 0;

  const categoryTitles = {
    singers: 'خوانندگان',
    players: 'نوازندگان',
    poets: 'شاعران',
    announcers: 'گویندگان',
    composers: 'آهنگسازان',
    arrangers: 'تنظیم کنندگان',
  };

  const availableCategories = Object.keys(data).filter(cat => 
    data[cat] && Object.keys(data[cat]).length > 0
  );

  return (
    <div className="tag-cloud w-full max-w-4xl mx-auto p-6">
      {programType && (
        <h3 className="text-xl mb-4 text-center text-gray-700">
          {programType}
        </h3>
      )}
      
      <div className="flex justify-center gap-4 mb-8" dir="rtl">
        {availableCategories.map(category => (
          <button 
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg ${
              selectedCategory === category 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
          >
            {categoryTitles[category]}
            <span className="text-sm mr-2">
              ({Object.keys(data[category]).length})
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap justify-center gap-4 p-8 bg-white rounded-xl shadow-lg" dir="rtl">
        {data[selectedCategory] && Object.entries(data[selectedCategory])
          .sort(([,a], [,b]) => b - a)
          .map(([name, count], index) => (
            <a
              key={index}
              href={`/${selectedCategory}/${encodeURIComponent(nameToSlug(name))}/`}
              className="transition-all duration-200 hover:text-blue-600"
              style={{
                fontSize: `${calculateSize(count, maxCount)}px`,
                opacity: 0.7 + (count / maxCount) * 0.3
              }}
            >
              {name}
              <span className="text-sm text-gray-500 mx-1">
                ({count})
              </span>
            </a>
          ))}
      </div>
    </div>
  );
};

export default TagCloud;
