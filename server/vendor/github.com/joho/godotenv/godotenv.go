package godotenv

import (
	"bufio"
	"os"
	"strings"
)

// Load reads a .env file and sets variables found within the process environment.
// If no filenames are provided, it defaults to ".env".
func Load(filenames ...string) error {
	if len(filenames) == 0 {
		filenames = []string{".env"}
	}
	for _, fname := range filenames {
		if err := loadFile(fname); err != nil {
			return err
		}
	}
	return nil
}

func loadFile(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if i := strings.Index(line, "="); i != -1 {
			key := strings.TrimSpace(line[:i])
			value := strings.TrimSpace(line[i+1:])
			os.Setenv(key, value)
		}
	}
	return scanner.Err()
}
